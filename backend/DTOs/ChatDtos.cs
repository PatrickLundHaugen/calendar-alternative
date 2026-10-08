using CalendarAlternative.Api.DTOs;

namespace CalendarAlternative.Api.DTOs;

public record ChatRequest(string Message);

// What the frontend receives. Title and DurationMinutes are needed later to create the event
// when the user clicks a suggestion. Suggestions is empty when there is nothing to pick.
public record ChatResponse(
    string Reply,
    string? Title,
    int? DurationMinutes,
    List<SlotSuggestion> Suggestions);

// What Gemini returns. Everything is a string or nullable because we do not trust it yet.
public record ParsedRequest
{
    public string Action { get; init; } = "other";
    public string? Title { get; init; }
    public int? DurationMinutes { get; init; }
    public string? Deadline { get; init; }
    public string? EarliestDate { get; init; }
    public string? PreferredTime { get; init; }
    public List<string>? PreferredDays { get; init; }
    public string? Reply { get; init; }
}