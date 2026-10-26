using CalendarAlternative.Api.DTOs;

namespace CalendarAlternative.Api.Services;

public class SchedulingService(EventService events)
{
    // Tunable rules
    public const int DayStartHour = 8;
    public const int DayEndHour = 22;
    public const int StepMinutes = 30;
    private const int DefaultHorizonDays = 14;

    // Ranking weights: lower score is better. The gaps make the priorities strict.
    private const double WrongDayPenalty = 1000;
    private const double WrongTimePenalty = 100;
    private const double PerDayDelay = 1;

    // Impure part: gets the events and the clock, then delegates to the pure method.
    public async Task<List<SlotSuggestion>> SuggestAsync(SchedulingRequest req)
    {
        var now = DateTime.Now;
        var (from, lastDay) = SearchWindow(req, now);
        var existing = await events.GetRangeAsync(from, lastDay.AddDays(1).ToDateTime(TimeOnly.MinValue));
        return FindSlots(req, existing, now);
    }

    // Pure part: same input always gives the same output.
    public List<SlotSuggestion> FindSlots(SchedulingRequest req, IReadOnlyList<EventDto> existing, DateTime now)
    {
        var (from, lastDay) = SearchWindow(req, now);
        var duration = TimeSpan.FromMinutes(req.DurationMinutes);
        var step = TimeSpan.FromMinutes(StepMinutes);
        var busy = existing.Where(e => e.Id != req.IgnoreEventId).ToList();
        var window = TimeWindow(req.PreferredTime);
        var hasDayPreference = req.PreferredDays is { Count: > 0 };

        var bestPerDay = new List<(double Score, SlotSuggestion Slot)>();
        var dayIndex = 0;

        for (var day = DateOnly.FromDateTime(from); day <= lastDay; day = day.AddDays(1), dayIndex++)
        {
            if (day == req.ExcludeDay) continue;
            var midnight = day.ToDateTime(TimeOnly.MinValue);
            var dayStart = midnight.AddHours(DayStartHour);
            var dayEnd = midnight.AddHours(DayEndHour);
            var dayMatches = !hasDayPreference || req.PreferredDays!.Contains(day.DayOfWeek);

            (double Score, SlotSuggestion Slot)? best = null;

            for (var start = dayStart > from ? dayStart : from; start + duration <= dayEnd; start += step)
            {
                var end = start + duration;
                if (busy.Any(e => e.Start < end && e.End > start)) continue;

                var timeMatches = start >= midnight.AddHours(window.FromHour)
                                  && end <= midnight.AddHours(window.ToHour);

                var score = (dayMatches ? 0 : WrongDayPenalty)
                            + (timeMatches ? 0 : WrongTimePenalty)
                            + dayIndex * PerDayDelay
                            + (start - dayStart).TotalMinutes / 10000; // tie-breaker: earlier is better

                if (best is null || score < best.Value.Score)
                    best = (score, new SlotSuggestion(start, end, dayMatches && timeMatches));
            }

            if (best is not null) bestPerDay.Add(best.Value);
        }

        return bestPerDay
            .OrderBy(x => x.Score)
            .Take(req.MaxSuggestions)
            .Select(x => x.Slot)
            .ToList();
    }

    // The period to search: from "now or notBefore, rounded up to the step" to the deadline day.
    private static (DateTime From, DateOnly LastDay) SearchWindow(SchedulingRequest req, DateTime now)
    {
        var earliest = req.NotBefore is { } nb && nb > now ? nb : now;
        var from = DateTime.SpecifyKind(RoundUp(earliest, StepMinutes), DateTimeKind.Unspecified);
        var lastDay = req.Deadline ?? DateOnly.FromDateTime(from.AddDays(DefaultHorizonDays));
        return (from, lastDay);
    }

    private static DateTime RoundUp(DateTime t, int minutes)
    {
        var ticks = TimeSpan.FromMinutes(minutes).Ticks;
        return new DateTime((t.Ticks + ticks - 1) / ticks * ticks, t.Kind);
    }

    private static (int FromHour, int ToHour) TimeWindow(PreferredTime t) => t switch
    {
        PreferredTime.Morning => (8, 12),
        PreferredTime.Afternoon => (12, 17),
        PreferredTime.Evening => (17, 22),
        _ => (0, 24),
    };
}