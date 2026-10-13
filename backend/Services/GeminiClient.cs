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
    public string Model { get; set; } = "gemini-3.6-flash";
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
      "action": { "type": "STRING", "enum": ["schedule", "reschedule", "other"] },
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
      "reply": { "type": "STRING", "nullable": true },
      "eventTitleHint": { "type": "STRING", "nullable": true },
      "eventDate": { "type": "STRING", "nullable": true }
    },
    "required": ["action", "preferredTime", "preferredDays"]
  }
  """)!;

  public async Task<ParsedRequest> ParseAsync(string message, DateTime now, bool rescheduling = false, IReadOnlyList<string>? history = null)
  {
    if (string.IsNullOrWhiteSpace(_options.ApiKey))
        throw new GeminiException(
            "Gemini API key is missing. Set it with: dotnet user-secrets set \"Gemini:ApiKey\" \"...\"", 500);

    // Earlier user messages are context only. The latest message is what we act on.
    var userText = history is { Count: > 0 }
        ? $"Earlier messages from the user (context only):\n{string.Join("\n", history.Select(h => "- " + h))}\n\nLatest message:\n{message}"
        : message;

    var body = new
    {
        systemInstruction = new { parts = new[] { new { text = BuildSystemPrompt(now, rescheduling) } } },
        contents = new[] { new { role = "user", parts = new[] { new { text = userText } } } },
        generationConfig = new { responseMimeType = "application/json", responseSchema = Schema },
    };

    using var doc = JsonDocument.Parse(await PostAsync(body));
    var text = doc.RootElement
        .GetProperty("candidates")[0]
        .GetProperty("content")
        .GetProperty("parts")[0]
        .GetProperty("text")
        .GetString();

    return JsonSerializer.Deserialize<ParsedRequest>(text ?? "{}", JsonSerializerOptions.Web)
           ?? new ParsedRequest();
  }

// Sends the request, retrying temporary failures (overload, timeouts) with a short pause.
private async Task<string> PostAsync(object body)
{
    const int maxAttempts = 3;

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            // A request message can only be sent once, so each attempt builds a fresh one
            using var request = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{_options.Model}:generateContent");
            request.Headers.Add("x-goog-api-key", _options.ApiKey);
            request.Content = JsonContent.Create(body);

            using var response = await http.SendAsync(request);
            var text = await response.Content.ReadAsStringAsync();
            if (response.IsSuccessStatusCode) return text;

            throw new GeminiException($"Gemini returned {(int)response.StatusCode}: {text}", (int)response.StatusCode);
        }
        catch (TaskCanceledException) // HttpClient reports a timeout this way
        {
            if (attempt == maxAttempts) throw new GeminiException("Gemini did not answer in time.", 504);
        }
        catch (HttpRequestException ex)
        {
            if (attempt == maxAttempts) throw new GeminiException($"Could not reach Gemini: {ex.Message}", 503);
        }
        catch (GeminiException ex) when ((ex.StatusCode is 503 or 500) && attempt < maxAttempts)
        {
            // temporary: fall through to the pause and try again
        }

        await Task.Delay(TimeSpan.FromSeconds(attempt * 2)); // 2 s, then 4 s
    }
}

  private static string BuildSystemPrompt(DateTime now, bool rescheduling)
  {
      var selectedRule = rescheduling
          ? "- The user has already selected the event to move. Use action \"reschedule\" for any message that says when or how it should move. Leave eventTitleHint and eventDate null."
          : "";

      return $"""
          You turn a user's chat message into a structured scheduling request for a calendar app.
          Today is {now.ToString("dddd yyyy-MM-dd", CultureInfo.InvariantCulture)} and the time is {now:HH:mm}. Weeks start on Monday.
          The user may write in English or Norwegian. Write any reply in the language the user used.

          Rules:
          - action = "schedule" when the user wants to find time for a new activity.
          - The user's message may come with earlier messages as context. Use them ONLY when the latest message cannot be
            understood alone, for example it only gives a duration, a title, a day or a time of day, or it asks for
            different options. When the latest message names its own activity, it is a complete new request: take every
            detail (duration, deadline, days, time of day) only from the latest message and never copy details from
            earlier messages.
          - action = "reschedule" when the user says they missed, could not do, or want to move an activity
            that is already in their calendar ("I didn't manage to study today", "move my run to Thursday").
            Set eventTitleHint to the key words naming that activity (for example "Java study"). Set eventDate to
            the date it was planned if the user says one ("today", "Monday"), otherwise null. Do not set durationMinutes.
          - Otherwise action = "other".
          - For action "other", put one short, friendly sentence in "reply". If the user wants to schedule something new
            but gave no duration, use action "other" and ask in "reply" how long it should take.
          {selectedRule}
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
}