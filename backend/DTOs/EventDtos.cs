using CalendarAlternative.Api.Models;

namespace CalendarAlternative.Api.DTOs;

// What the API sends to the frontend
public record EventDto(int Id, string Title, DateTime Start, DateTime End, string? Color);

// What the frontend sends when creating or updating an event.
// The last three are optional and only used for the activity log.
public record SaveEventRequest(
    string Title,
    DateTime Start,
    DateTime End,
    string? Color = null,
    EventSource? Source = null,
    int? SuggestionSetId = null,
    int? SlotIndex = null);