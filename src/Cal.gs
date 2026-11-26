/**
 * Finalsay: Cal.gs. The only file that talks to Google Calendar. Read-only, and off by default.
 *
 * It is used only when Settings > "Calendar capture" is TRUE, and it needs the scope
 * https://www.googleapis.com/auth/calendar.readonly, which is NOT in the default manifest
 * (see SETUP.md, "Calendar capture"). NOT VERIFIED LIVE.
 */
var Cal = (function () {
  /** Events on your default calendar in the next `days` days, as plain objects. */
  function upcoming(days) {
    var from = new Date(), to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    return CalendarApp.getDefaultCalendar().getEvents(from, to).map(function (e) {
      return {
        id: e.getId(), title: e.getTitle(), start: e.getStartTime(),
        guests: e.getGuestList().map(function (g) { return String(g.getEmail()).toLowerCase(); })
      };
    });
  }
  return { upcoming: upcoming };
})();
