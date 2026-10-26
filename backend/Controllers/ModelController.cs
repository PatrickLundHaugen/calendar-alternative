using CalendarAlternative.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CalendarAlternative.Api.Controllers;

[ApiController]
[Route("api/model")]
public class ModelController(TrainingDataBuilder data) : ControllerBase
{
    // Counts of the training rows, and optionally the first few rows, so the data can be checked by eye
    [HttpGet("status")]
    public async Task<IActionResult> Status([FromQuery] int preview = 0)
    {
        var rows = await data.BuildAsync();

        return Ok(new
        {
            totalRows = rows.Count,
            byKind = rows.GroupBy(r => r.Kind).ToDictionary(g => g.Key.ToString(), g => g.Count()),
            preview = rows.Take(Math.Clamp(preview, 0, 20)).Select(r => new
            {
                kind = r.Kind.ToString(),
                label = r.Label,
                weight = r.Weight,
                title = r.Title,
                start = r.Start,
                features = r.Features,
            }),
        });
    }
}