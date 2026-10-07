using CalendarAlternative.Api.DTOs;
using CalendarAlternative.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CalendarAlternative.Api.Controllers;

[ApiController]
[Route("api/events")]
public class EventsController(EventService events) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<EventDto>>> Get([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (to <= from) return BadRequest("'to' must be after 'from'.");
        return Ok(await events.GetRangeAsync(from, to));
    }

    [HttpPost]
    public async Task<ActionResult<EventDto>> Create(SaveEventRequest req)
    {
        var error = Validate(req);
        if (error is not null) return BadRequest(error);
        return Ok(await events.CreateAsync(req));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<EventDto>> Update(int id, SaveEventRequest req)
    {
        var error = Validate(req);
        if (error is not null) return BadRequest(error);

        var updated = await events.UpdateAsync(id, req);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        return await events.DeleteAsync(id) ? NoContent() : NotFound();
    }

    private static string? Validate(SaveEventRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return "Title is required.";
        if (req.End <= req.Start) return "End must be after start.";
        return null;
    }
}