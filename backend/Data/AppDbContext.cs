using CalendarAlternative.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CalendarAlternative.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<CalendarEvent> Events => Set<CalendarEvent>();
}