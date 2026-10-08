namespace CalendarAlternative.Api.DTOs;

public enum PreferredTime { Any, Morning, Afternoon, Evening }

public record SchedulingRequest(
    int DurationMinutes,
    DateOnly? Deadline = null,
    PreferredTime PreferredTime = PreferredTime.Any,
    List<DayOfWeek>? PreferredDays = null,
    DateTime? NotBefore = null,
    int? IgnoreEventId = null,
    int MaxSuggestions = 3);

public record SlotSuggestion(DateTime Start, DateTime End, bool MatchesPreferences);