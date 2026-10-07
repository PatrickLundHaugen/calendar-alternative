namespace CalendarAlternative.Api.DTOs;

// What the API sends to the frontend
public record EventDto(int Id, string Title, DateTime Start, DateTime End);

// What the frontend sends when creating or updating an event
public record SaveEventRequest(string Title, DateTime Start, DateTime End);