using CalendarAlternative.Api.DTOs;
using CalendarAlternative.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CalendarAlternative.Api.Controllers;

[ApiController]
[Route("api/scheduling")]
public class SchedulingController(SchedulingService scheduling) : ControllerBase
{
    [HttpPost("suggestions")]
    public async Task<ActionResult<List<SlotSuggestion>>> Suggest(SchedulingRequest req)
    {
        if (req.DurationMinutes is < 15 or > 720)
            return BadRequest("Duration must be between 15 and 720 minutes.");
        if (req.MaxSuggestions is < 1 or > 10)
            return BadRequest("MaxSuggestions must be between 1 and 10.");

        return Ok(await scheduling.SuggestAsync(req));
    }
}