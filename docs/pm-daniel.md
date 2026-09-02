# PM authorization and catalog

`pmAuthorized` is a narrow, temporary capability. Daniel is the only mechanic
authorized to create or perform PM Work Orders; administrators can review PM
details but cannot change them. This is intentionally not a general mechanic
to job-category assignment system.

The next iteration should replace this flag with a managed assignment policy
that can associate multiple mechanics with job categories and individual work.
Until then, PM part selections and observed mileage are recorded per PM Work
Order, while every change to the truck's canonical mileage is auditable.
