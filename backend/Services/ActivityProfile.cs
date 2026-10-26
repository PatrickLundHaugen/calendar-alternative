namespace CalendarAlternative.Api.Services;

public record HistoryEvent(int Id, string Title, DateTime Start, DateTime End);

// How the current slot compares with earlier events that have similar titles
public record Similarity(int Count, double WeekdayShare, double TimeShare, double StartHourDiff, double DurationDiff);

// What the calendar says about habits: which earlier events look like this activity?
public class ActivityProfile(IEnumerable<HistoryEvent> history)
{
    private record Item(HistoryEvent Event, HashSet<string> Words);

    private static readonly char[] Separators = [' ', ',', '.', '-', '/', ':', ';', '(', ')'];
    private readonly List<Item> _items = history.Select(h => new Item(h, Words(h.Title))).ToList();

    public static HashSet<string> Words(string title) =>
        title.ToLowerInvariant()
            .Split(Separators, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3)
            .ToHashSet();

    public static double Hour(DateTime t) => t.Hour + t.Minute / 60.0;

    // Same windows as the scheduling engine: morning, afternoon, evening
    public static int Bucket(DateTime t) => t.Hour < 12 ? 0 : t.Hour < 17 ? 1 : 2;

    // Compares a slot with earlier events that share a title word. ignoreIds are left out,
    // so an event never counts as evidence about itself.
    public Similarity Compare(string title, DateTime start, DateTime end, IReadOnlyCollection<int> ignoreIds)
    {
        var words = Words(title);
        var similar = _items
            .Where(i => !ignoreIds.Contains(i.Event.Id) && i.Words.Overlaps(words))
            .Select(i => i.Event)
            .ToList();
        if (similar.Count == 0) return new Similarity(0, 0, 0, 0, 0);

        var bucket = Bucket(start);
        var weekdayShare = similar.Count(e => e.Start.DayOfWeek == start.DayOfWeek) / (double)similar.Count;
        var timeShare = similar.Count(e => Bucket(e.Start) == bucket) / (double)similar.Count;
        var startHourDiff = Math.Abs(Hour(start) - similar.Average(e => Hour(e.Start)));
        var durationDiff = Math.Abs((end - start).TotalMinutes - similar.Average(e => (e.End - e.Start).TotalMinutes));

        return new Similarity(similar.Count, weekdayShare, timeShare, startHourDiff, durationDiff);
    }
}