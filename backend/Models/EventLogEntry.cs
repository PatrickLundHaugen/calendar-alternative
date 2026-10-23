namespace CalendarAlternative.Api.Models;

public enum EventLogKind { Created, Moved, Deleted }

public enum EventSource { Form, Drag, AiNew, AiMove }

public class EventLogEntry
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; }
    public EventLogKind Kind { get; set; }
    public int EventId { get; set; } // a plain number on purpose: no foreign key, so the row survives deletion
    public string Title { get; set; } = string.Empty;
    public DateTime Start { get; set; } // where the event is now (or was, for Deleted)
    public DateTime End { get; set; }
    public DateTime? PreviousStart { get; set; } // only for Moved
    public DateTime? PreviousEnd { get; set; }
    public EventSource Source { get; set; }
    public int? SuggestionSetId { get; set; }
}