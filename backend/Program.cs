using CalendarAlternative.Api.Data;
using Microsoft.EntityFrameworkCore;
using CalendarAlternative.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<EventService>();

var app = builder.Build();

app.MapControllers();
app.Run();