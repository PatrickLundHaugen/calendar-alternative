using CalendarAlternative.Api.DTOs;

namespace CalendarAlternative.Api.Services;

public class ChatService(GeminiClient gemini, SchedulingService scheduling)
{
    public async Task<ChatResponse> HandleAsync(string message)
    {
        var parsed = await gemini.ParseAsync(message, DateTime.Now);

        // Not a scheduling request, or no duration: show Gemini's short reply
        if (parsed.Action != "schedule" || parsed.DurationMinutes is not int minutes)
            return Say(parsed.Reply ?? "I can help you find time for an activity. Try: \"Find me two hours to study Java this week.\"");

        if (minutes is < 15 or > 720)
            return Say("Please choose a duration between 15 minutes and 12 hours.");

        var title = string.IsNullOrWhiteSpace(parsed.Title) ? "Task" : parsed.Title.Trim();

        // Validate everything Gemini gave us before it reaches the engine
        var request = new SchedulingRequest(
            DurationMinutes: minutes,
            Deadline: ParseDate(parsed.Deadline),
            PreferredTime: Enum.TryParse<PreferredTime>(parsed.PreferredTime, true, out var pt) && Enum.IsDefined(pt)
                ? pt
                : PreferredTime.Any,
            PreferredDays: ParseDays(parsed.PreferredDays),
            NotBefore: ParseDate(parsed.EarliestDate)?.ToDateTime(TimeOnly.MinValue));

        var slots = await scheduling.SuggestAsync(request);
        return new ChatResponse(BuildReply(title, minutes, slots), title, minutes, slots);
    }

    private static ChatResponse Say(string text) => new(text, null, null, []);

    private static DateOnly? ParseDate(string? s) =>
        DateOnly.TryParseExact(s, "yyyy-MM-dd", out var d) ? d : null;

    private static List<DayOfWeek> ParseDays(List<string>? names) =>
        (names ?? [])
            .Select(n => Enum.TryParse<DayOfWeek>(n, true, out var d) && Enum.IsDefined(d) ? (DayOfWeek?)d : null)
            .OfType<DayOfWeek>() // drops the nulls and unwraps the nullable
            .Distinct()
            .ToList();

    // Reply text is written here, not by Gemini, so times and counts can never be invented.
    private static string BuildReply(string title, int minutes, List<SlotSuggestion> slots)
    {
        var length = minutes % 60 == 0 ? $"{minutes / 60} h" : $"{minutes} min";

        if (slots.Count == 0)
            return $"I could not find a free {length} slot for \"{title}\" in that period. Try a later deadline or a shorter duration.";
        if (slots.All(s => !s.MatchesPreferences))
            return $"Nothing fits your preferences, but these are the closest options for \"{title}\" ({length}):";
        if (slots.Any(s => !s.MatchesPreferences))
            return $"Here are some options for \"{title}\" ({length}). Some are outside your preferences:";
        return $"Here are {slots.Count} options for \"{title}\" ({length}):";
    }
}