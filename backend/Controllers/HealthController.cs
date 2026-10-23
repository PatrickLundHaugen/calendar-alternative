using CalendarAlternative.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CalendarAlternative.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        return Ok(new
        {
            status = "ok",
            eventCount = await db.Events.CountAsync(),
            eventLogEntries = await db.EventLogEntries.CountAsync(),
            suggestionSets = await db.SuggestionSets.CountAsync(),
            chosenSuggestions = await db.SuggestionOptions.CountAsync(o => o.Chosen),
        });
    }
}