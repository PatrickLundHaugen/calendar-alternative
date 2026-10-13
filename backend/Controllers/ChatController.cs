using CalendarAlternative.Api.DTOs;
using CalendarAlternative.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CalendarAlternative.Api.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController(ChatService chat, ILogger<ChatController> logger) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ChatResponse>> Post(ChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message) || req.Message.Length > 500)
            return BadRequest("Message must be between 1 and 500 characters.");

        try
        {
            if (req.History is { Count: > 6 } || req.History?.Any(h => h.Length > 500) == true)
                return BadRequest("History is too long.");

            return Ok(await chat.HandleAsync(req.Message, req.SelectedEventId, req.History));
        }
        catch (GeminiException ex)
        {
            // Full details go to the server log only, the user gets a short message
            logger.LogError("Gemini error: {Message}", ex.Message);
            return ex.StatusCode switch
            {
                429 => StatusCode(429, "The AI is rate limited right now. Wait a minute, then press Try again."),
                503 or 504 => StatusCode(503, "The AI is busy right now. Press Try again in a moment."),
                _ => StatusCode(502, "The AI service is unavailable. Check the backend log for details."),
            };
        }
    }
}