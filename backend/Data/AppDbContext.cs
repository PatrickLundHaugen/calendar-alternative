using CalendarAlternative.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CalendarAlternative.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<CalendarEvent> Events => Set<CalendarEvent>();
    public DbSet<SuggestionSet> SuggestionSets => Set<SuggestionSet>();
    public DbSet<SuggestionOption> SuggestionOptions => Set<SuggestionOption>();
    public DbSet<EventLogEntry> EventLogEntries => Set<EventLogEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Store enums as text, so the database is readable
        modelBuilder.Entity<EventLogEntry>().Property(e => e.Kind).HasConversion<string>();
        modelBuilder.Entity<EventLogEntry>().Property(e => e.Source).HasConversion<string>();
    }
}