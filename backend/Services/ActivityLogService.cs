using CalendarAlternative.Api.Data;
using CalendarAlternative.Api.DTOs;
using CalendarAlternative.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CalendarAlternative.Api.Services;

// Records what the user is offered and what they do. This is the training data for later.
// Logging must never break the calendar, so failures here are only written to the server log.
public class ActivityLogService(AppDbContext db, ILogger<ActivityLogService> logger)
{
    // Stores the suggestions that were shown. Returns the set id, or null when nothing was stored.
    public async Task<int?> RecordSuggestionsAsync(string title, int minutes, SchedulingRequest req, List<SlotSuggestion> slots)
    {
        if (slots.Count == 0) return null;

        try
        {
            var set = new SuggestionSet
            {
                CreatedAt = DateTime.Now,
                Title = title,
                DurationMinutes = minutes,
                PreferredTime = req.PreferredTime.ToString(),
                PreferredDays = string.Join(",", req.PreferredDays ?? []),
                Deadline = req.Deadline,
                MovedEventId = req.IgnoreEventId,
                Options = slots
                    .Select((s, i) => new SuggestionOption
                    {
                        Rank = i,
                        Start = s.Start,
                        End = s.End,
                        MatchesPreferences = s.MatchesPreferences,
                    })
                    .ToList(),
            };
            db.SuggestionSets.Add(set);
            await db.SaveChangesAsync();
            return set.Id;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not log suggestions");
            return null;
        }
    }

    // Stores one event action. If it came from a suggestion, that option is marked as chosen.
    public async Task RecordEventAsync(
        EventLogKind kind, EventDto e, EventSource source,
        DateTime? previousStart = null, DateTime? previousEnd = null,
        int? suggestionSetId = null, int? slotIndex = null)
    {
        try
        {
            db.EventLogEntries.Add(new EventLogEntry
            {
                Timestamp = DateTime.Now,
                Kind = kind,
                EventId = e.Id,
                Title = e.Title,
                Start = e.Start,
                End = e.End,
                PreviousStart = previousStart,
                PreviousEnd = previousEnd,
                Source = source,
                SuggestionSetId = suggestionSetId,
            });

            if (suggestionSetId is int setId && slotIndex is int rank)
            {
                var options = await db.SuggestionOptions.Where(o => o.SuggestionSetId == setId).ToListAsync();
                if (!options.Any(o => o.Chosen))
                {
                    // The start time must match too, so a wrong index can never mark the wrong option
                    var option = options.FirstOrDefault(o => o.Rank == rank && o.Start == e.Start);
                    if (option is not null) option.Chosen = true;
                }
            }

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not log event action");
        }
    }
}