namespace CalendarAlternative.Api.Models;

// One batch of suggestions shown in the chat. Kept as training data.
public class SuggestionSet
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Title { get; set; } = string.Empty;
    public int DurationMinutes { get; set; }
    public string PreferredTime { get; set; } = "Any";
    public string PreferredDays { get; set; } = string.Empty; // comma separated, empty means no preference
    public DateOnly? Deadline { get; set; }
    public int? MovedEventId { get; set; } // set when the suggestions were for moving an existing event
    public List<SuggestionOption> Options { get; set; } = [];
}

public class SuggestionOption
{
    public int Id { get; set; }
    public int SuggestionSetId { get; set; }
    public int Rank { get; set; } // position in the list that was shown, starting at 0
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public bool MatchesPreferences { get; set; }
    public bool Chosen { get; set; }
}