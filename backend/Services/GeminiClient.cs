using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CalendarAlternative.Api.DTOs;
using Microsoft.Extensions.Options;

namespace CalendarAlternative.Api.Services;

public class GeminiOptions
{
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "gemini-3.5-flash";
}

public class GeminiException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public class GeminiClient(HttpClient http, IOptions<GeminiOptions> options)
{
    private readonly GeminiOptions _options = options.Value;

    // The shape Gemini must answer in. Types are written in capitals in this API.
    private static readonly JsonNode Schema = JsonNode.Parse("""
    {
      "type": "OBJECT",
      "properties": {
        "action": { "type": "STRING", "enum": ["schedule", "other"] },
        "title": { "type": "STRING", "nullable": true },
        "durationMinutes": { "type": "INTEGER", "nullable": true },
        "deadline": { "type": "STRING", "nullable": true },
        "earliestDate": { "type": "STRING", "nullable": true },
        "preferredTime": { "type": "STRING", "enum": ["any", "morning", "afternoon", "evening"] },
        "preferredDays": {
          "type": "ARRAY",
          "items": {
            "type": "STRING",
            "enum": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
          }
        },
        "reply": { "type": "STRING", "nullable": true }
      },
      "required": ["action", "preferredTime", "preferredDays"]
    }
    """)!;

    public async Task<ParsedRequest> ParseAsync(string message, DateTime now)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new GeminiException(
                "Gemini API key is missing. Set it with: dotnet user-secrets set \"Gemini:ApiKey\" \"...\"", 500);

        var body = new
        {
            systemInstruction = new { parts = new[] { new { text = BuildSystemPrompt(now) } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = message } } } },
            generationConfig = new { responseMimeType = "application/json", responseSchema = Schema },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{_options.Model}:generateContent");
        request.Headers.Add("x-goog-api-key", _options.ApiKey); // key goes in a header, not the URL
        request.Content = JsonContent.Create(body);

        using var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new GeminiException($"Gemini returned {(int)response.StatusCode}: {error}", (int)response.StatusCode);
        }

        // The JSON we asked for arrives as text inside candidates[0].content.parts[0].text
        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        return JsonSerializer.Deserialize<ParsedRequest>(text ?? "{}", JsonSerializerOptions.Web)
               ?? new ParsedRequest();
    }

    private static string BuildSystemPrompt(DateTime now) => $"""
        You turn a user's chat message into a structured scheduling request for a calendar app.
        Today is {now.ToString("dddd yyyy-MM-dd", CultureInfo.InvariantCulture)} and the time is {now:HH:mm}. Weeks start on Monday.
        The user may write in English or Norwegian. Write any reply in the language the user used.

        Rules:
        - action = "schedule" when the user wants to find time for an activity. Otherwise action = "other".
        - For action "other", put one short, friendly sentence in "reply". If the user wants to schedule something
          but gave no duration, use action "other" and ask in "reply" how long it should take.
        - title: a short name for the activity, for example "Study Java".
        - durationMinutes: the total time the user needs, in minutes.
        - deadline: yyyy-MM-dd. "before X", "by X" and "until X" all mean X itself, inclusive.
          "this week" means the coming Sunday. null if no deadline is given.
        - earliestDate: yyyy-MM-dd, only when the user says it must not start before a date,
          for example "next week" means next Monday. null otherwise.
        - preferredTime: "morning", "afternoon" or "evening" when stated or clearly implied
          ("after 17:00" means evening). Otherwise "any".
        - preferredDays: English weekday names. Expand ranges ("Tuesday to Thursday") and groups
          ("weekdays" is Monday to Friday, "weekend" is Saturday and Sunday). Empty list if none are stated.
        - Never invent details the user did not give.
        """;
}