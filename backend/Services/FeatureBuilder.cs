using CalendarAlternative.Api.DTOs;

namespace CalendarAlternative.Api.Services;

// The numbers the model sees for one candidate slot. Floats, because ML.NET wants them.
public class SlotFeatures
{
    public float DurationMinutes { get; set; }
    public float Weekday { get; set; } // Monday = 0 ... Sunday = 6
    public float IsWeekend { get; set; }
    public float StartHour { get; set; } // 18.5 means 18:30
    public float EndHour { get; set; }
    public float EventsThatDay { get; set; }
    public float BusyMinutesThatDay { get; set; }
    public float GapBeforeMinutes { get; set; } // free time to the event before, capped
    public float GapAfterMinutes { get; set; } // free time to the event after, capped
    public float SimilarCount { get; set; } // how many similar earlier events there are (how much to trust the next four)
    public float SimilarWeekdayShare { get; set; }
    public float SimilarTimeShare { get; set; }
    public float SimilarStartHourDiff { get; set; }
    public float SimilarDurationDiff { get; set; }
}

// Pure: the same input always gives the same numbers. Used for both training and scoring.
public static class FeatureBuilder
{
    private const double NoNeighbour = 720; // minutes, used when nothing is before or after on that day

    public static SlotFeatures Build(
        string title, DateTime start, DateTime end,
        IReadOnlyList<EventDto> events, ActivityProfile profile, IReadOnlyCollection<int> ignoreIds)
    {
        var dayStart = start.Date;
        var dayEnd = dayStart.AddDays(1);
        var sameDay = events
            .Where(e => !ignoreIds.Contains(e.Id) && e.Start < dayEnd && e.End > dayStart)
            .ToList();

        var busy = sameDay.Sum(e => (Earlier(e.End, dayEnd) - Later(e.Start, dayStart)).TotalMinutes);
        var gapBefore = sameDay.Where(e => e.End <= start)
            .Select(e => (start - e.End).TotalMinutes)
            .DefaultIfEmpty(NoNeighbour).Min();
        var gapAfter = sameDay.Where(e => e.Start >= end)
            .Select(e => (e.Start - end).TotalMinutes)
            .DefaultIfEmpty(NoNeighbour).Min();

        var similar = profile.Compare(title, start, end, ignoreIds);
        var weekday = ((int)start.DayOfWeek + 6) % 7;

        return new SlotFeatures
        {
            DurationMinutes = (float)(end - start).TotalMinutes,
            Weekday = weekday,
            IsWeekend = weekday >= 5 ? 1 : 0,
            StartHour = (float)ActivityProfile.Hour(start),
            EndHour = (float)ActivityProfile.Hour(end),
            EventsThatDay = sameDay.Count,
            BusyMinutesThatDay = (float)busy,
            GapBeforeMinutes = (float)Math.Min(gapBefore, NoNeighbour),
            GapAfterMinutes = (float)Math.Min(gapAfter, NoNeighbour),
            SimilarCount = similar.Count,
            SimilarWeekdayShare = (float)similar.WeekdayShare,
            SimilarTimeShare = (float)similar.TimeShare,
            SimilarStartHourDiff = (float)similar.StartHourDiff,
            SimilarDurationDiff = (float)similar.DurationDiff,
        };
    }

    private static DateTime Earlier(DateTime a, DateTime b) => a < b ? a : b;
    private static DateTime Later(DateTime a, DateTime b) => a > b ? a : b;
}