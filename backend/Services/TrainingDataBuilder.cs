using CalendarAlternative.Api.Data;
using CalendarAlternative.Api.DTOs;
using CalendarAlternative.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CalendarAlternative.Api.Services;

public enum ExampleKind { Positive, SampledNegative, OfferedNegative, MovedAwayNegative }

// One row for the model: the numbers, the right answer (Label) and how much the row counts (Weight).
// Kind, Title and Start are only for humans reading the status endpoint.
public record TrainingExample(ExampleKind Kind, bool Label, float Weight, string Title, DateTime Start, SlotFeatures Features);

// Turns history into training rows. Same split as SchedulingService: BuildAsync loads data,
// Build is pure (same input, same rows).
public class TrainingDataBuilder(AppDbContext db, EventService eventService)
{
    // Tunable starting values, to be adjusted once we can evaluate
    private const int SamplesPerPositive = 4;
    private const int SampleDayRange = 2; // days on each side of the event
    private const double HalfLifeDays = 90;
    private const double WeakNegativeFactor = 0.5;

    // Same limits the scheduling engine uses
    private const int MinMinutes = 15;
    private const int MaxMinutes = 720;

    public async Task<List<TrainingExample>> BuildAsync()
    {
        var events = await eventService.GetRangeAsync(new DateTime(2000, 1, 1), new DateTime(2100, 1, 1));
        var sets = await db.SuggestionSets.Include(s => s.Options).AsNoTracking().ToListAsync();
        var log = await db.EventLogEntries.AsNoTracking().ToListAsync();
        return Build(events, sets, log, DateTime.Now);
    }

    public static List<TrainingExample> Build(
        IReadOnlyList<EventDto> events, IReadOnlyList<SuggestionSet> sets,
        IReadOnlyList<EventLogEntry> log, DateTime now)
    {
        var profile = new ActivityProfile(events.Select(e => new HistoryEvent(e.Id, e.Title, e.Start, e.End)));
        var rows = new List<TrainingExample>();

        // 1. Every event is a positive. Free slots near it are sampled negatives.
        foreach (var e in events.Where(e => Usable(e.Start, e.End)))
        {
            var ignore = new[] { e.Id }; // the event is not evidence about itself
            var weight = Weight(e.Start, now);
            rows.Add(Example(ExampleKind.Positive, true, weight, e.Title, e.Start, e.End, events, profile, ignore));

            foreach (var (start, end) in SampleFreeSlots(e, events))
                rows.Add(Example(ExampleKind.SampledNegative, false, weight, e.Title, start, end, events, profile, ignore));
        }

        // 2. Options the user was offered and passed on (only in sets where one was chosen)
        foreach (var set in sets.Where(s => s.Options.Any(o => o.Chosen)))
        {
            var ignore = new List<int>();
            if (set.MovedEventId is int moved) ignore.Add(moved);
            ignore.AddRange(log.Where(l => l.SuggestionSetId == set.Id).Select(l => l.EventId));

            var weight = Weight(set.CreatedAt, now);
            foreach (var o in set.Options.Where(o => !o.Chosen && Usable(o.Start, o.End)))
                rows.Add(Example(ExampleKind.OfferedNegative, false, weight, set.Title, o.Start, o.End, events, profile, ignore));
        }

        // 3. Slots an event was moved away from: a weaker signal
        foreach (var m in log.Where(l => l.Kind == EventLogKind.Moved && l.PreviousStart is not null && l.PreviousEnd is not null))
        {
            var start = m.PreviousStart!.Value;
            var end = m.PreviousEnd!.Value;
            if (!Usable(start, end)) continue;

            var weight = Weight(m.Timestamp, now) * WeakNegativeFactor;
            rows.Add(Example(ExampleKind.MovedAwayNegative, false, weight, m.Title, start, end, events, profile, new[] { m.EventId }));
        }

        return rows;
    }

    private static TrainingExample Example(
        ExampleKind kind, bool label, double weight, string title, DateTime start, DateTime end,
        IReadOnlyList<EventDto> events, ActivityProfile profile, IReadOnlyCollection<int> ignore) =>
        new(kind, label, (float)weight, title, start, FeatureBuilder.Build(title, start, end, events, profile, ignore));

    // The engine only schedules single-day blocks of 15 to 720 minutes, so only those can be learned
    private static bool Usable(DateTime start, DateTime end)
    {
        var minutes = (end - start).TotalMinutes;
        return start.Date == end.Date && minutes >= MinMinutes && minutes <= MaxMinutes;
    }

    // Newer rows count more: the weight halves every HalfLifeDays
    private static double Weight(DateTime when, DateTime now) =>
        Math.Pow(0.5, Math.Max((now - when).TotalDays, 0) / HalfLifeDays);

    // Free slots on the same grid the scheduling engine uses, near the event, excluding its own time
    private static List<(DateTime Start, DateTime End)> SampleFreeSlots(EventDto e, IReadOnlyList<EventDto> events)
    {
        var duration = e.End - e.Start;
        var step = TimeSpan.FromMinutes(SchedulingService.StepMinutes);
        var candidates = new List<(DateTime Start, DateTime End)>();

        for (var offset = -SampleDayRange; offset <= SampleDayRange; offset++)
        {
            var midnight = e.Start.Date.AddDays(offset);
            var dayEnd = midnight.AddHours(SchedulingService.DayEndHour);

            for (var start = midnight.AddHours(SchedulingService.DayStartHour); start + duration <= dayEnd; start += step)
            {
                var end = start + duration;
                if (start == e.Start) continue;
                if (events.Any(o => o.Id != e.Id && o.Start < end && o.End > start)) continue;
                candidates.Add((start, end));
            }
        }

        // A fixed seed per event, so the same data always gives the same rows
        var random = new Random(e.Id);
        return candidates.OrderBy(_ => random.Next()).Take(SamplesPerPositive).ToList();
    }
}