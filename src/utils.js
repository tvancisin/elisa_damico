
import * as d3 from "d3";

export async function getIndividualCSV(path) {
  let loadedData = await d3.csv(path);
  return loadedData;
}

export async function getCSV(paths) {
  const promises = paths.map(path => getIndividualCSV(path));
  const results = await Promise.all(promises);
  return results;
}

export async function getGeo(url) {
  let response = await fetch((import.meta.env.BASE_URL || "") + url);
  let json = await response.json();
  return json;
}

export async function getGeoMultiple(urls) {
  const promises = urls.map(url => getGeo(url));
  const results = await Promise.all(promises);
  return results; // array of GeoJSON objects
}

export function construct_points(data) {
  return {
    type: "FeatureCollection",
    features: data.map((d) => {
      const coordinates = [+d.med_loc_x, +d.med_loc_y];

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: coordinates, // [longitude, latitude]
        },
        properties: {
          conflict_country: d.conflict_country,
          mediation_count: +d.mediation_count,
          fatalities_best: +d.fatalities_best,
          agreements_sum: +d.agreements_sum,
          dist_mediation_conflict: +d.dist_mediation_conflict,
        },
      };
    }),
  };
}

export function construct_line(data) {
  return {
    type: "FeatureCollection",
    features: data.map((d) => {
      const start = [+d.longitude_con, +d.latitude_con];
      const end = [+d.med_loc_x, +d.med_loc_y];

      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: arcPoints(start, end, 0.2, 100),
        },
        properties: {
          conflict_country: d.conflict_country,
          mediation_count: +d.mediation_count,
          fatalities_best: +d.fatalities_best,
          agreements_sum: +d.agreements_sum,
          dist_mediation_conflict: +d.dist_mediation_conflict,
        },
      };
    }),
  };
}

export function createGeoJSONCircle(center, radiusInKm, points) {
  if (!points) points = 100;

  var coords = {
    latitude: center[1],
    longitude: center[0],
  };

  var km = radiusInKm;

  var ret = [];
  var distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  var distanceY = km / 110.574;

  var theta, x, y;
  for (var i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ret],
        },
        properties: {}, // optional, but good practice
      },
    ],
  };
}

function arcPoints(a, b, r_frac, n) {
  // a: origin point
  // b: destination point
  // r_frac: arc radius as a fraction of half the distance between a and b
  // -- 1 results in a semicircle arc, the arc flattens out the closer to 0 the number is set, 0 is invalid
  // n: number of points to sample from arc
  let c = getCenter(a, b, r_frac);
  let r = dist(c, a);

  let aAngle = Math.atan2(a[1] - c[1], a[0] - c[0]),
    bAngle = Math.atan2(b[1] - c[1], b[0] - c[0]);

  if (aAngle > bAngle) {
    bAngle += 2 * Math.PI;
  }

  let sampledPoints = d3
    .range(aAngle, bAngle, (bAngle - aAngle) / n)
    .map((d) => [Math.cos(d) * r + c[0], Math.sin(d) * r + c[1]]);

  sampledPoints.push(b);

  return sampledPoints;
}

function getCenter(a, b, frac) {
  let c = getP3(a, b, frac);
  let b1 = yIntercept(a, b);
  let b2 = yIntercept(a, c);
  let m1 = inverseSlope(a, b);
  let m2 = inverseSlope(a, c);

  // find the intersection of the two perpendicular bisectors
  // i.e. solve m1 * x + b2 = m2 * x + b2 for x
  let x = (b2 - b1) / (m1 - m2);
  // sub x back into one of the linear equations to get y
  let y = m1 * x + b1;

  return [x, y];
}

function yIntercept(a, b) {
  // returns the y intercept of the perpendicular bisector of the line from point A to B
  let m = inverseSlope(a, b);
  let p = midpoint(a, b);
  let x = p[0];
  let y = p[1];
  return y - m * x;
}

function inverseSlope(a, b) {
  // returns the inverse of the slope of the line from point A to B
  // which is the slope of the perpendicular bisector
  return -1 * (1 / slope(a, b));
}

function slope(a, b) {
  // returns the slope of the line from point A to B
  return (b[1] - a[1]) / (b[0] - a[0]);
}

function getP3(a, b, frac) {
  let mid = midpoint(a, b);
  let m = inverseSlope(a, b);
  // check if B is below A
  let bLower = b[1] < a[1] ? -1 : 1;

  // distance from midpoint along slope: between 0 and half the distance between the two points
  let d = 0.5 * dist(a, b) * frac;

  let x = d / Math.sqrt(1 + Math.pow(m, 2));
  let y = m * x;
  return [bLower * x + mid[0], bLower * y + mid[1]];
  // return [mid[0] + d, mid[1] - (d * (b[0] - a[0])) / (b[1] - a[1])];
}

function dist(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}