using System.Globalization;
using System.Text.Json;
using CalendarAlternative.Api.DTOs;

namespace CalendarAlternative.Api.Services;

public class ChatService(GeminiClient gemini, SchedulingService scheduling, EventService events, ActivityLogService activity, ILogger<ChatService> logger)
{

    private const int MaxDurationMinutes = 720;

    public async Task<ChatResponse> HandleAsync(string message, int? selectedEventId = null, List<string>? history = null)
    {
        // An event picked in the calendar is looked up here. Gemini only learns that one was picked.
        EventDto? selected = null;
        if (selectedEventId is int id)
        {
            selected = await events.GetByIdAsync(id);
            if (selected is null) return Say("That event no longer exists.");
        }

        var parsed = await gemini.ParseAsync(message, DateTime.Now, rescheduling: selected is not null, history: history);
        logger.LogInformation("Gemini parsed: {Parsed}", JsonSerializer.Serialize(parsed));

        if (parsed.Action == "reschedule")
        {
            var target = selected;
            string? problem = null;
            if (target is null) (target, problem) = await FindEventAsync(parsed);

            return target is null ? Say(problem!) : await RescheduleAsync(target, parsed);
        }

        // An event is selected but the message did not say how to move it
        if (selected is not null)
            return Say(parsed.Reply ?? "Tell me when it should move, for example \"Thursday evening\".");

        if (parsed.Action != "schedule" || parsed.DurationMinutes is not int minutes)
            return Say(parsed.Reply ?? "I can help you find time for an activity. Try: \"Find me two hours to study Java this week.\"");

        if (minutes is < 15 or > MaxDurationMinutes)
            return Say("Please choose a duration between 15 minutes and 12 hours.");

        var title = string.IsNullOrWhiteSpace(parsed.Title) ? "Task" : parsed.Title.Trim();
        var request = BuildRequest(parsed, minutes);
        var slots = await scheduling.SuggestAsync(request);
        var setId = await activity.RecordSuggestionsAsync(title, minutes, request, slots);
        return new ChatResponse(BuildReply(title, minutes, slots), title, minutes, slots, SuggestionSetId: setId);
    }

    private async Task<ChatResponse> RescheduleAsync(EventDto target, ParsedRequest parsed)
    {
        var minutes = (int)(target.End - target.Start).TotalMinutes;
        if (minutes > MaxDurationMinutes) return Say("That event is too long to reschedule automatically.");

        // Same engine as scheduling. The event ignores itself, and its own day is skipped.
        var request = BuildRequest(parsed, minutes) with
        {
            IgnoreEventId = target.Id,
            ExcludeDay = DateOnly.FromDateTime(target.Start),
        };

        var slots = await scheduling.SuggestAsync(request);
        var setId = await activity.RecordSuggestionsAsync(target.Title, minutes, request, slots);
        return new ChatResponse(BuildReply(target.Title, minutes, slots, target), target.Title, minutes, slots, target.Id, setId);
    }

    // Finds the event Gemini's keywords point at. Returns the event, or a message for the user.
    private async Task<(EventDto? Event, string? Problem)> FindEventAsync(ParsedRequest parsed)
    {
        const string howTo = "Open the event in the calendar, choose Reschedule with AI, and tell me when it should move.";

        var hint = parsed.EventTitleHint?.Trim() ?? "";
        var words = hint.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(w => w.Length >= 3)
            .ToList();
        if (words.Count == 0) return (null, $"Which event do you mean? {howTo}");

        var today = DateTime.Now.Date;
        var nearby = await events.GetRangeAsync(today.AddDays(-14), today.AddDays(30));

        var scored = nearby
            .Select(e => (Event: e, Score: words.Count(w => e.Title.Contains(w, StringComparison.OrdinalIgnoreCase))))
            .Where(x => x.Score > 0)
            .ToList();

        // If a date was mentioned and some matches fall on it, only keep those
        if (ParseDate(parsed.EventDate) is { } date)
        {
            var onDay = scored.Where(x => DateOnly.FromDateTime(x.Event.Start) == date).ToList();
            if (onDay.Count > 0) scored = onDay;
        }

        if (scored.Count == 0) return (null, $"I could not find an event matching \"{hint}\". {howTo}");

        var top = scored.Max(x => x.Score);
        var best = scored.Where(x => x.Score == top).Select(x => x.Event).ToList();
        if (best.Count == 1) return (best[0], null);

        var list = string.Join("; ", best.Take(5).Select(e => $"\"{e.Title}\" {Describe(e.Start)}"));
        return (null, $"Several events match: {list}. {howTo}");
    }

    private static SchedulingRequest BuildRequest(ParsedRequest parsed, int minutes) => new(
        DurationMinutes: minutes,
        Deadline: ParseDate(parsed.Deadline),
        PreferredTime: Enum.TryParse<PreferredTime>(parsed.PreferredTime, true, out var pt) && Enum.IsDefined(pt)
            ? pt
            : PreferredTime.Any,
        PreferredDays: ParseDays(parsed.PreferredDays),
        NotBefore: ParseDate(parsed.EarliestDate)?.ToDateTime(TimeOnly.MinValue));

    private static ChatResponse Say(string text) => new(text, null, null, []);

    private static string Describe(DateTime t) => t.ToString("ddd d MMM HH:mm", CultureInfo.InvariantCulture);

    private static DateOnly? ParseDate(string? s) =>
        DateOnly.TryParseExact(s, "yyyy-MM-dd", out var d) ? d : null;

    private static List<DayOfWeek> ParseDays(List<string>? names) =>
        (names ?? [])
            .Select(n => Enum.TryParse<DayOfWeek>(n, true, out var d) && Enum.IsDefined(d) ? (DayOfWeek?)d : null)
            .OfType<DayOfWeek>()
            .Distinct()
            .ToList();

    // Reply text is written here, not by Gemini, so times and counts can never be invented.
    private static string BuildReply(string title, int minutes, List<SlotSuggestion> slots, EventDto? moving = null)
    {
        var length = minutes % 60 == 0 ? $"{minutes / 60} h" : $"{minutes} min";
        var what = moving is null ? $"\"{title}\" ({length})" : $"\"{title}\" (now {Describe(moving.Start)})";
        var options = moving is null ? "options" : "alternatives";

        if (slots.Count == 0)
            return moving is null
                ? $"I could not find a free {length} slot for \"{title}\" in that period. Try a later deadline or a shorter duration."
                : $"I could not find another free time for {what} in that period. Try a later deadline or different preferences.";
        if (slots.All(s => !s.MatchesPreferences))
            return $"Nothing fits your preferences, but these are the closest {options} for {what}:";
        if (slots.Any(s => !s.MatchesPreferences))
            return $"Here are some {options} for {what}. Some are outside your preferences:";
        var many = slots.Count != 1;
        var verb = many ? "are" : "is";
        var noun = moving is null
            ? (many ? "options" : "option")
            : (many ? "alternatives" : "alternative");

        return $"Here {verb} {slots.Count} {noun} for {what}:";
    }
}