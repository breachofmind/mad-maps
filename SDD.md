# Mapinski

## Purpose
"Mapinski" is a web application that is for creating and viewing custom maps using the Mapbox client API.
It is similar to Google's "My Maps" application, in that it allows users to create unique maps that
can be seen in the Google Maps Platform.

Primary, this project is being built in order to learn the nuances of Mapbox, since I may be using
it a lot in the near future. However, I use the "My Maps" application and want to create a more modern
application that gives me more flexibility and can export to a KML format for use inside of Google Maps.

## Features
Mapinski should provide the following features:

1. Full-page / full-screen map view.
2. Ability to change the map base layer (such as terrain or satellite) and styling.
3. Drawing toolset for creating routes, polygons, adding pins, and styling pins.
4. Associate data to pins or geometry, such as titles/descriptions in HTML format.
5. Change pin image and color.
6. Ability to create layers and assign geometry, pins and other content to individual named layers.
7. Ability to hide or show layers.
8. Search feature for finding locations on the map for quick adding.
9. Ability to export map data as GeoJSON or KML for use in other applications.
10. Page for creating/managing user-created maps or for importing maps.

Overall, this application is similar to Google's "My Maps" web application, just with a more
modern and improved user interface and using MapBox client.

## Preferred tech stack
- Vite + React (next.js) front-end with material UI components
- PostgreSQL relational database
- Mapbox client
- Google Maps API for location search
- Express-based REST API server
- Typescript for both front and back-end javascript
- Google auth for user auth, no managing password
- database session management