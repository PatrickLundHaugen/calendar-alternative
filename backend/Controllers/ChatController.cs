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
            return Ok(await chat.HandleAsync(req.Message));
        }
        catch (GeminiException ex)
        {
            // Full details go to the server log only, the user gets a short message
            logger.LogError("Gemini error: {Message}", ex.Message);
            return ex.StatusCode == 429
                ? StatusCode(429, "The AI is rate limited right now. Wait a minute and try again.")
                : StatusCode(502, "The AI service is unavailable. Check the backend log for details.");
        }
    }
}