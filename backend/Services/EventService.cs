using CalendarAlternative.Api.Data;
using CalendarAlternative.Api.DTOs;
using CalendarAlternative.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CalendarAlternative.Api.Services;

public class EventService(AppDbContext db)
{
    private static EventDto ToDto(CalendarEvent e) => new(e.Id, e.Title, e.Start, e.End, e.Color);

    // Events that overlap the range [from, to). Overlap check: starts before the range ends
    // AND ends after the range starts. This also catches events that span the range edges.
    public async Task<List<EventDto>> GetRangeAsync(DateTime from, DateTime to)
    {
        var events = await db.Events
            .Where(e => e.Start < to && e.End > from)
            .OrderBy(e => e.Start)
            .ToListAsync();
        return events.Select(ToDto).ToList();
    }

    public async Task<EventDto> CreateAsync(SaveEventRequest req)
    {
        var entity = new CalendarEvent { Title = req.Title.Trim(), Start = req.Start, End = req.End, Color = req.Color };
        db.Events.Add(entity);
        await db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<EventDto?> UpdateAsync(int id, SaveEventRequest req)
    {
        var entity = await db.Events.FindAsync(id);
        if (entity is null) return null;

        entity.Title = req.Title.Trim();
        entity.Start = req.Start;
        entity.End = req.End;
        if (req.Color is not null) entity.Color = req.Color;

        await db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entity = await db.Events.FindAsync(id);
        if (entity is null) return false;

        db.Events.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<EventDto?> GetByIdAsync(int id)
    {
        var entity = await db.Events.FindAsync(id);
        return entity is null ? null : ToDto(entity);
    }
}