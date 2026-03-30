---
"fusion-action-app-change": major
---
Remove the `mono` input and simplify app discovery to use `app-paths`
directly, defaulting to `.` when no paths are provided. This changes the
action's configuration and default detection behavior, and also adds extra
debug logging for changed file and app matching.

Provide `app-paths` if your apps are not in the path `"."`.
