<script>
  import * as d3 from "d3";
  import RangeSlider from "svelte-range-slider-pips";
  import CirclePoint from "./lib/CirclePoint.svelte";

  import {
    getCSV,
    getGeoMultiple,
    createGeoJSONCircle,
    construct_line,
    construct_points,
  } from "./utils.js";
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import "mapbox-gl/dist/mapbox-gl.css";

  let width = 400;
  let height = 400;
  let isOverlayVisible = true;
  let enabled = false;
  let selectedCountry = "Afghanistan";

  // remove initial div
  function removeOverlay() {
    isOverlayVisible = false;
    enabled = true;
  }

  let blah = createGeoJSONCircle([67.709953, 33.93911], 1500);
  let krava = createGeoJSONCircle([67.709953, 33.93911], 5000);

  let mapContainer;
  mapboxgl.accessToken =
    "pk.eyJ1Ijoic2FzaGFnYXJpYmFsZHkiLCJhIjoiY2xyajRlczBlMDhqMTJpcXF3dHJhdTVsNyJ9.P_6mX_qbcbxLDS1o_SxpFg";

  // load data
  let geo;
  let scatter;
  let geo_data;
  let map;
  let path = ["./elisa_map.csv", "./final_month.csv"];
  let conflict_groups;
  let cleaned_geo;
  let cleaned_geo_1;
  let sortedByDate = [];
  getCSV(path).then((data) => {
    geo = data[0];
    conflict_groups = d3.groups(geo, (d) => d.conflict_country);

    cleaned_geo_1 = geo
      .map((d) => {
        // Reject rows where any relevant field is "NA"
        if (
          d.dist_mediation_conflict === "NA" ||
          d.fatalities_best === "NA" ||
          d.latitude_con === "NA" ||
          d.longitude_con === "NA" ||
          d.iso3c === "NA"
        ) {
          return null;
        }

        const distance = +d.dist_mediation_conflict;
        const deaths = +d.fatalities_best;

        if (!isFinite(distance) || distance <= 0) {
          return null;
        }

        return {
          ...d,
          distance,
          deaths: isFinite(deaths) ? deaths : 0,
        };
      })
      .filter(Boolean);

    scatter = data[1];
    const idMap = new Map();
    let currentId = 1;

    cleaned_geo = scatter
      .map((d) => {
        if (
          d.dist_mediation_conflict === "NA" ||
          d.fatalities_best === "NA" ||
          d.latitude_con === "NA" ||
          d.longitude_con === "NA" ||
          d.iso3c === "NA"
        ) {
          return null;
        }

        const distance = +d.dist_mediation_conflict;
        const deaths = +d.fatalities_best;

        if (!isFinite(distance) || distance <= 0) {
          return null;
        }

        const year = d.YYYYMM.slice(0, 4);
        const month = d.YYYYMM.slice(4, 6);
        const formatted = `${month}-${year}`;

        // Build a composite key
        const key = `${d.conflict_country}-${distance}`;
        let id;

        if (idMap.has(key)) {
          id = idMap.get(key);
        } else {
          id = currentId++;
          idMap.set(key, id);
        }

        return {
          ...d,
          distance,
          date: formatted,
          deaths: isFinite(deaths) ? deaths : 0,
          id, // assigned ID based on shared distance & country
        };
      })
      .filter(Boolean);

    sortedByDate = cleaned_geo.sort((a, b) => {
      // Convert "MM-YYYY" to "YYYY-MM" for proper comparison
      const [aMonth, aYear] = a.date.split("-");
      const [bMonth, bYear] = b.date.split("-");

      const aDate = `${aYear}-${aMonth}`;
      const bDate = `${bYear}-${bMonth}`;

      return aDate.localeCompare(bDate);
    });
  });

  const json_path = ["geojson.json"];
  getGeoMultiple(json_path).then((geo) => {
    geo_data = geo[0];
  });

  onMount(() => {
    map = new mapboxgl.Map({
      container: mapContainer,
      style: "mapbox://styles/sashagaribaldy/cm6ktkpxn00m901s2fo0bh1e4",
      projection: "naturalEarth",
      center: [10, 10],
      zoom: 1.2,
      logoPosition: "top-right",
    });

    map.on("load", () => {
      if (conflict_groups[0][1] && geo_data) {
        const lines = construct_line(conflict_groups[0][1]);
        const points = construct_points(conflict_groups[0][1]);

        map.addSource("countries", {
          type: "geojson",
          data: geo_data,
          generateId: true, // Ensures all features have unique IDs
        });

        // Labels layer beneath polygons
        const labelLayerId = map
          .getStyle()
          .layers.find(
            (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
          )?.id;

        // Add fill layer with conditional color
        map.addLayer(
          {
            id: "countries_fill",
            type: "fill",
            source: "countries",
            paint: {
              "fill-color": "steelblue",
              "fill-opacity": 0.8,
            },
            filter: ["in", "ADMIN", "Afghanistan"],
          },
          labelLayerId,
        );

        map.addSource("polygon", {
          type: "geojson",
          data: blah,
        });

        map.addLayer({
          id: "polygon",
          type: "fill",
          source: "polygon",
          paint: {
            "fill-color": "steelblue",
            "fill-opacity": 0.2,
          },
        });

        map.addSource("polygon3", {
          type: "geojson",
          data: krava,
        });

        map.addLayer({
          id: "polygon3",
          type: "fill",
          source: "polygon3",
          paint: {
            "fill-color": "steelblue",
            "fill-opacity": 0.2,
          },
        });

        map.addSource("curved-line", {
          type: "geojson",
          data: lines,
        });

        map.addLayer({
          id: "curved-line",
          type: "line",
          source: "curved-line",
          paint: {
            "line-color": "white",
            "line-width": 1,
            "line-opacity": 0.5,
          },
        });

        map.addSource("points", {
          type: "geojson",
          data: points, // output of your `construct_points()` function
        });

        map.addLayer({
          id: "point-layer",
          type: "circle",
          source: "points",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "agreements_sum"],
              0,
              0, // agreements_sum = 0 → radius = 0
              1,
              5, // agreements_sum = 1 → radius = 5
              5,
              10, // agreements_sum = 10 → radius = 15
              10,
              20, // agreements_sum = 50 → radius = 25 (adjust scale as needed)
            ],
            "circle-color": "#FF5722",
            "circle-opacity": 0.5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    });

    return () => map.remove();
  });

  function updateMapData(conflictData) {
    selectedCountry = conflictData;

    const entry = conflict_groups.find(([name]) => name === conflictData);
    let update_data = entry[1];

    if (!map || !map.isStyleLoaded()) return;

    const newLines = construct_line(update_data);
    const newPoints = construct_points(update_data);
    let newBlah = createGeoJSONCircle(
      [+update_data[0].longitude_con, +update_data[0].latitude_con],
      1500,
    );
    let newKrava = createGeoJSONCircle(
      [+update_data[0].longitude_con, +update_data[0].latitude_con],
      5000,
    );

    const lineSource = map.getSource("curved-line");
    const pointSource = map.getSource("points");
    const polygonSource = map.getSource("polygon");
    const polygon3Source = map.getSource("polygon3");

    if (lineSource && pointSource && polygonSource) {
      map.setFilter("countries_fill", ["==", "ADMIN", conflictData]);
      lineSource.setData(newLines);
      pointSource.setData(newPoints);
      polygonSource.setData(newBlah);
      polygon3Source.setData(newKrava);
    } else {
      console.warn("Map sources not found.");
    }
  }

  // code for arcs
  // let arcs = [];
  // const startX = 75;
  // $: if (geo) {
  //   const parsedData = geo
  //     .map((d) => {
  //       const distance = +d.dist_mediation_conflict;
  //       const agreements = +d.agreements_sum;

  //       if (!isFinite(distance) || isNaN(distance) || distance <= 0) {
  //         return null;
  //       }

  //       return {
  //         ...d,
  //         distance,
  //         agreements:
  //           isFinite(agreements) && !isNaN(agreements) ? agreements : 0,
  //       };
  //     })
  //     .filter((d) => d !== null);

  //   const maxDistance = d3.max(parsedData, (d) => d.distance);
  //   const maxAgreements = d3.max(parsedData, (d) => d.agreements);

  //   const xScale = d3
  //     .scaleLinear()
  //     .domain([0, 17000000])
  //     .range([80, width - 20]);

  //   const rScale = d3
  //     .scaleSqrt() // use square root for visual area scaling
  //     .domain([0, maxAgreements])
  //     .range([0, 20]); // adjust min/max radius as needed

  //   arcs = parsedData.map((d) => {
  //     const xEnd = xScale(d.distance);
  //     const radius = (xEnd - startX) / 2;

  //     const arcPath = `
  //       M ${startX},${height - 50}
  //       A ${radius},${radius} 0 0,1 ${xEnd},${height - 50}
  //     `;

  //     return {
  //       d: arcPath,
  //       x: xEnd,
  //       y: height - 50,
  //       r: rScale(d.agreements),
  //       conflict_country: d.conflict_country,
  //       distance: d.distance,
  //       agreements: d.agreements,
  //     };
  //   });
  // }

  $: x_scale = d3
    .scaleLinear()
    .domain([0, 17000000])
    .range([80, width - 20]);

  $: y_scale = d3
    .scaleLinear()
    .domain([0, 12000])
    .range([height - 50, 10]);

  $: y_scale1 = d3
    .scaleLinear()
    .domain([0, 25000])
    .range([height - 50, 10]);

  // axes for scatterplot
  let x_axis_grp;
  let x_axis_grp1;
  let y_axis_grp;
  let y_axis_grp1;
  $: if (x_axis_grp1 && y_axis_grp1) {
    let xAxis = d3.axisBottom(x_scale);
    d3.select(x_axis_grp).call(xAxis);
    let xAxis1 = d3.axisBottom(x_scale);
    d3.select(x_axis_grp1).call(xAxis1);
    let yAxis = d3.axisLeft(y_scale);
    d3.select(y_axis_grp).call(yAxis);
    let yAxis1 = d3.axisLeft(y_scale1);
    d3.select(y_axis_grp1).call(yAxis1);
  }

  // Data state
  let dates = [];
  let selectedDateIndex = 0;
  let filtered_geo = [];

  // Extract and sort dates when sortedByDate is ready
  $: if (sortedByDate) {
    const dateSet = new Set(
      sortedByDate.map((d) => d.YYYYMM).filter((ym) => ym && ym.length > 4),
    );
    dates = Array.from(dateSet).sort();
    // selectedDateIndex = dates.length - 1;
    updateFilteredGeo();
  }

  function updateFilteredGeo() {
    const selectedDate = dates[selectedDateIndex];
    filtered_geo = sortedByDate.filter((d) => d.YYYYMM === selectedDate);
    console.log("Filtered data:", filtered_geo);
  }

  function formatLabel(index) {
    const yyyymm = dates[index];
    if (!yyyymm) return "";
    return `${yyyymm.slice(4)}-${yyyymm.slice(0, 4)}`; // MM-YYYY
  }

  // let playing = false;
  // let interval;
  // function togglePlay() {
  //   playing = !playing;
  //   if (playing) {
  //     interval = setInterval(() => {
  //       if (selectedDateIndex < dates.length - 1) {
  //         selectedDateIndex += 1;
  //         updateFilteredGeo();
  //       } else {
  //         clearInterval(interval);
  //         playing = false;
  //       }
  //     }, 500); // Change speed (ms) here
  //   } else {
  //     clearInterval(interval);
  //   }
  // }

  let activeChart = "overall"; // or 'monthly'
</script>

<main>
  <h1>
    Bridging the Distance:<br /> New Insights on Geography in Conflict Mediation
  </h1>
  <h2 style="font-size: 22px;">
    <a href="https://www.elisadamico.net/" target="_blank">Elisa D'Amico</a>
  </h2>
  <div class="blog_text">
    <p>
      Until recently, we haven’t been able to answer basic questions about the
      logistics of conflict mediation and how they shape outcomes, largely due
      to a lack of systematic data. As a result, factors like where mediation
      takes place have remained understudied. With <a
        href="https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/PYRHS6"
        target="_blank">new data</a
      > now available, researchers are beginning to examine these overlooked dimensions,
      including recent work on the role of location in the mediation process.
    </p>
    <p>
      A recent study, <a
        href="https://github.com/elisadamico/The-Geography-of-Conflict-Mediation/blob/main/DAmico_TheGeographyofConflictMediation.pdf"
        target="_blank"
        >“The Geography of Conflict Mediation: Proximity and Success in Armed
        Conflict Resolutions,”</a
      > looks at how the distance between conflict zones and mediation sites affects
      the chances of reaching a peaceful outcome. Drawing on newly available geospatial
      data, the study finds that location plays a meaningful role in shaping mediation
      success.
    </p>
    <h2>The Paradox of Distance: Agreements vs. De-escalation</h2>
    <p>The research highlights a fascinating duality in mediation success:</p>

    <ol>
      <li>
        <strong>Distant Mediation Fosters Agreements</strong>: The study finds
        that the further a mediation event is from a conflict area, the higher
        the likelihood of a formal peace agreement being signed. This suggests
        that a greater geographical distance can confer perceived neutrality,
        reduce immediate local political pressures, and allow parties to
        negotiate without the intense emotional and security concerns that often
        plague discussions held closer to the conflict. The data indicates that
        for every additional “far away” mediation event, the odds of a peace
        agreement being signed increase by approximately 14.2%. This underscores
        the strategic value of neutral ground when aiming for formal
        settlements.
      </li>
    </ol>
  </div>
  <div id="buttons">
    <button
      disabled={!enabled}
      class:selected={selectedCountry === "Afghanistan"}
      on:click={() => updateMapData("Afghanistan")}
    >
      Afghanistan
    </button>

    <button
      disabled={!enabled}
      class:selected={selectedCountry === "Israel"}
      on:click={() => updateMapData("Israel")}
    >
      Israel
    </button>

    <button
      disabled={!enabled}
      class:selected={selectedCountry === "Libya"}
      on:click={() => updateMapData("Libya")}
    >
      Libya
    </button>

    <button
      disabled={!enabled}
      class:selected={selectedCountry === "Sudan"}
      on:click={() => updateMapData("Sudan")}
    >
      Sudan
    </button>

    <button
      disabled={!enabled}
      class:selected={selectedCountry === "Syria"}
      on:click={() => updateMapData("Syria")}
    >
      Syria
    </button>

    <button
      disabled={!enabled}
      class:selected={selectedCountry === "Yemen"}
      on:click={() => updateMapData("Yemen")}
    >
      Yemen
    </button>
  </div>
  <div class="map-wrapper">
    {#if isOverlayVisible}
      <div class="overlay">
        <button class="remove-overlay" on:click={removeOverlay}>
          Click to Explore
        </button>
      </div>
    {/if}
    <div id="map" bind:this={mapContainer}></div>
  </div>
  <div id="legend">
    <svg width="400px" height="75px">
      <text x="0" y="10" fill="white" font-size="10"
        >Number of Peace Agreements</text
      >
      <circle
        cx="20"
        cy="50"
        r="5"
        fill="#FF5722"
        fill-opacity="0.2"
        stroke="white"
      ></circle>
      <line
        x1="20"
        y1="45"
        x2="70"
        y2="45"
        stroke="white"
        stroke-dasharray="4,2"
      ></line>
      <text
        x="75"
        y="45"
        fill="white"
        font-size="10"
        alignment-baseline="middle">5</text
      >

      <circle
        cx="20"
        cy="45"
        r="10"
        fill="#FF5722"
        fill-opacity="0.2"
        stroke="white"
      ></circle>
      <line
        x1="20"
        y1="35"
        x2="70"
        y2="35"
        stroke="white"
        stroke-dasharray="4,2"
      ></line>
      <text
        x="75"
        y="35"
        fill="white"
        font-size="10"
        alignment-baseline="middle">10</text
      >

      <circle
        cx="20"
        cy="40"
        r="15"
        fill="#FF5722"
        fill-opacity="0.2"
        stroke="white"
      ></circle>
      <line
        x1="20"
        y1="25"
        x2="70"
        y2="25"
        stroke="white"
        stroke-dasharray="4,2"
      ></line>
      <text
        x="75"
        y="25"
        fill="white"
        font-size="10"
        alignment-baseline="middle">20</text
      >

      <text x="200" y="10" fill="white" font-size="10"
        >Distance from conflict</text
      >
      <line
        x1="250"
        y1="40"
        x2="300"
        y2="40"
        stroke="white"
        stroke-dasharray="4,2"
      />
      <text x="305" y="43" fill="white" font-size="10">1,500km</text>
      <circle
        cx="250"
        cy="50"
        r="25"
        fill="steelblue"
        fill-opacity="0.2"
        stroke="none"
      />
      <line
        x1="250"
        y1="25"
        x2="300"
        y2="25"
        stroke="white"
        stroke-dasharray="4,2"
      />
      <text x="305" y="28" fill="white" font-size="10">5,000km</text>
      <circle
        cx="250"
        cy="50"
        r="10"
        fill="steelblue"
        fill-opacity="0.2"
        stroke="none"
      />
    </svg>
  </div>

  <div class="blog_text">
    <ol start="2">
      <li>
        <strong>Closer Proximity Reduces Violence</strong>: Conversely, the
        research demonstrates that closer proximity between a mediation event
        and the conflict zone is directly linked to a greater reduction in
        violent events and fatalities. This is because localized mediation can
        foster trust, directly engage local actors, address specific grievances,
        and enable quicker responses to escalating violence on the ground. Such
        immediacy, driven by close proximity, acts as a powerful catalyst for
        de-escalation. Specifically, for every additional “close by” mediation
        event, the expected number of battle deaths in the following month
        decreases by approximately 4.7%.
      </li>
    </ol>
  </div>

  <div class="chart-toggle-buttons">
    <button
      id="all"
      on:click={() => (activeChart = "overall")}
      class:active={activeChart === "overall"}
    >
      Overall Correlation
    </button>
    <button
      id="month"
      on:click={() => (activeChart = "monthly")}
      class:active={activeChart === "monthly"}
    >
      Monthly Correlation
    </button>
  </div>

  {#if activeChart === "overall"}
    <div id="chart01" bind:clientWidth={width} bind:clientHeight={height}>
      <h2>Overall fatalities-distance correlation</h2>
      <svg {width} {height}>
        <g bind:this={x_axis_grp1} transform={`translate(0, ${height - 40})`} />
        <g bind:this={y_axis_grp1} transform={`translate(75, 0)`} />
        <text x={width / 2 - 75} y={height} fill="white" font-size="14px"
          >Distance from Conflict</text
        >
        <text
          x={20}
          y={height / 2}
          fill="white"
          font-size="14px"
          transform={`rotate(-90, 20, ${height / 2})`}
        >
          Number of Fatalities
        </text>

        <!-- Dashed lines -->
        <line
          x1={x_scale(1500000)}
          x2={x_scale(1500000)}
          y1={20}
          y2={height - 40}
          stroke="gray"
          stroke-dasharray="4,2"
          stroke-width="1"
        />
        <text x={x_scale(1500000) + 5} y={25} fill="white" font-size="10">
          1,500km
        </text>

        <line
          x1={x_scale(5000000)}
          x2={x_scale(5000000)}
          y1={20}
          y2={height - 40}
          stroke="gray"
          stroke-dasharray="4,2"
          stroke-width="1"
        />
        <text x={x_scale(5000000) + 5} y={25} fill="white" font-size="10">
          5,000km
        </text>

        {#if cleaned_geo_1}
          {#each cleaned_geo_1 as g}
            <circle
              cx={x_scale(g.distance)}
              cy={y_scale1(g.deaths)}
              r="3"
              fill="steelblue"
              fill-opacity="0.4"
              stroke="none"
            >
            </circle>
          {/each}
        {/if}
      </svg>
    </div>
  {/if}

  {#if activeChart === "monthly"}
    <div id="slider">
      <h2>Monthly changes in distance-fatalities correlation</h2>
      <p style="font-size: 12px;">Toggle to see changes over time</p>
      <!-- <button on:click={togglePlay}>
      {playing ? "Pause" : "Play"}
    </button> -->
      {#if dates.length > 0}
        <RangeSlider
          min={0}
          max={dates.length - 1}
          step={1}
          values={[selectedDateIndex]}
          on:change={(e, i) => {
            selectedDateIndex = e.detail.values[0];
            updateFilteredGeo();
          }}
          formatter={formatLabel}
          pips
          float
        />
      {/if}
      <div class="year-labels">
        {#each [2018, 2019, 2020, 2021, 2022, 2023, 2024] as year}
          <span>{year}</span>
        {/each}
      </div>
    </div>
    <br />
    <div id="chart1" bind:clientWidth={width} bind:clientHeight={height}>
      <svg {width} {height}>
        <g bind:this={x_axis_grp} transform={`translate(0, ${height - 40})`} />
        <g bind:this={y_axis_grp} transform={`translate(75, 0)`} />
        <text x={width / 2 - 75} y={height} fill="white" font-size="14px"
          >Distance from Conflict</text
        >
        <text
          x={20}
          y={height / 2}
          fill="white"
          font-size="14px"
          transform={`rotate(-90, 20, ${height / 2})`}
        >
          Number of Fatalities
        </text>
        <!-- Dashed lines -->
        <line
          x1={x_scale(1500000)}
          x2={x_scale(1500000)}
          y1={20}
          y2={height - 40}
          stroke="gray"
          stroke-dasharray="4,2"
          stroke-width="1"
        />
        <text x={x_scale(1500000) + 5} y={25} fill="white" font-size="10">
          1,500km
        </text>

        <line
          x1={x_scale(5000000)}
          x2={x_scale(5000000)}
          y1={20}
          y2={height - 40}
          stroke="gray"
          stroke-dasharray="4,2"
          stroke-width="1"
        />
        <text x={x_scale(5000000) + 5} y={25} fill="white" font-size="10">
          5,000km
        </text>

        {#if filtered_geo}
          {#each filtered_geo as g}
            <CirclePoint x={x_scale(g.distance)} y={y_scale(g.deaths)} r={4} />
          {/each}
        {/if}
      </svg>
    </div>
  {/if}

  <div class="blog_text">
    <h2>Implications for Peacemakers</h2>
    <p>
      This groundbreaking work signals a vital redefinition of “conflict
      resolution” for peacemakers. It suggests that success isn’t a singular
      metric. Formal agreements may indeed require the neutral, removed spaces
      offered by distant mediation, but the necessary work of reducing violence
      on the ground often happens closer to the epicenter of conflict through
      local engagement and direct intervention.
    </p>
    <p>
      For policymakers and peace practitioners, these findings prompt a deeper
      reflection on priorities and strategies:
    </p>
    <ul>
      <li>
        <strong>Tailor the Approach to the Goal</strong>: If the primary
        objective is a formal peace agreement, seeking geographically distant
        and neutral mediation venues appears to be a more effective strategy.
      </li>
      <li>
        <strong>Invest in Localized Efforts</strong>: For immediate
        de-escalation and mitigation of fatalities, greater investment in and
        support for localized mediation efforts are essential. These efforts
        leverage intimate knowledge of the conflict context and facilitate
        trust-building among directly affected parties.
      </li>
      <li>
        <strong>A Holistic Strategy</strong>: True conflict resolution requires
        a holistic strategy that values both formal peace agreements and
        on-the-ground violence reduction. This may necessitate a multi-layered
        approach, combining distant high-level negotiations with embedded,
        proximate mediation initiatives.
      </li>
    </ul>
    <p>
      In an era of persistent and complex conflicts, understanding the
      geographical dynamics of mediation is no longer a peripheral concern—it is
      central to building effective and sustainable peace. By strategically
      considering where we mediate, we can significantly enhance our collective
      ability to resolve conflicts and mitigate human suffering.
    </p>
    <h2>Sources</h2>
    <ul>
      <li>
        data on mediation events comes from the Mediation Event and Negotiators
        Database (MEND) V1: Peter, Mateja; Badanjak, Sanja; D'Amico, Elisa;
        Houghton, Kasia, 2025, "Mediation Event and Negotiators Database
        (MEND)", <a
          href="https://dataverse.harvard.edu/citation?persistentId=doi:10.7910/DVN/PYRHS6"
          >doi.org/10.7910/DVN/PYRHS6</a
        >, Harvard Dataverse, V1
      </li>
      <li>
        data on peace agreements comes from the PA-X Database Version 9: Bell,
        C., & Badanjak, S. (2019). Introducing PA-X: A new peace agreement
        database and dataset. Journal of Peace Research, 56(3), 452-466.
        Available at <a href="https://pax.peaceagreements.org/"
          >pax.peaceagreements.org</a
        >
      </li>
      <li>
        data on fatalities comes from the: UCDP Georeferenced Event Dataset
        (GED) Global version 24.1  Davies, Shawn, Garoun Engström, Therese
        Pettersson & Magnus Öberg (2024). Organized violence 1989-2023, and the
        prevalence of organized crime groups. Journal of Peace Research 61(4).
      </li>
    </ul>
  </div>

  <h2 style="font-size: 16px;">
    Web & Visualization: <a href="https://tomasvancisin.co.uk/"
      >Tomas Vancisin</a
    >
  </h2>
  <!-- <div id="chart">
    <svg {width} {height}>
      <g bind:this={x_axis_grp1} transform={`translate(0, ${height - 40})`} />
      <text x={width / 2} y={height} fill="white" font-size="14px"
        >Distance from Conflict</text
      >
      {#each arcs as arc}
        <path
          d={arc.d}
          fill="none"
          stroke="steelblue"
          stroke-width="1"
          stroke-opacity="0.3"
        >
          <title
            >{arc.conflict_country}: {arc.distance.toLocaleString()} meters</title
          >
        </path>
      {/each}
      {#each arcs as arc}
        <circle
          cx={arc.x}
          cy={arc.y}
          r={arc.r}
          fill="tomato"
          fill-opacity="0.5"
          stroke="black"
        >
          <title>
            {arc.conflict_country} — Agreements: {arc.agreements}
          </title>
        </circle>
      {/each}
    </svg>
  </div> -->
</main>

<style>
  .map-wrapper {
    position: relative;
    width: 100%;
    height: 80vh; /* or whatever height you need */
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 80%;
    height: 80vh;
    margin: 0px auto;
    background-color: rgba(255, 255, 255, 0);
    display: flex;
    border-radius: 5px;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .remove-overlay {
    color: black;
    width: 150px;
    height: 150px;
    border-radius: 50%;
    border: none;
    background-color: rgba(255, 255, 255, 0.8);
    font-family: "Montserrat", sans-serif;
    font-size: 20px;
    font-optical-sizing: auto;
    font-weight: 400;
    font-style: normal;
  }

  .remove-overlay:hover {
    cursor: pointer;
    background-color: red;
    color: white;
  }

  button {
    background-color: #001c23;
    border: solid 1px rgb(99, 99, 99);
    color: white;
    padding: 4px 20px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background-color: steelblue;
  }

  button:disabled {
    cursor: not-allowed;
  }

  main {
    display: flex;
    flex-direction: column;
    padding: 20px;
    max-width: 100%;
    box-sizing: border-box;
    color: rgb(246, 246, 234);
  }

  h1 {
    width: 80%;
    margin: 50px auto;
    text-align: center;
  }

  h2 {
    width: 80%;
    margin: 5px auto;
    text-align: center;
    font-size: 20px;
  }

  li {
    padding: 5px;
  }

  .blog_text,
  #buttons {
    width: 65%;
    margin: 50px auto;
  }

  @media (max-width: 768px) {
    .blog_text,
    #buttons {
      width: 95%;
    }
  }

  #buttons {
    text-align: center;
    margin: 10px auto;
  }

  #legend {
    width: 80%;
    margin: auto;
  }

  #map,
  #chart01,
  #chart1 {
    width: 80%;
    height: 80vh;
    margin: auto;
  }

  #slider,
  .chart-toggle-buttons {
    width: 80%;
    margin: auto;
    text-align: center;
  }

  a {
    color: steelblue;
  }

  .selected {
    background-color: steelblue;
    color: white;
  }

  .chart-toggle-buttons {
    margin-bottom: 1em;
  }

  .chart-toggle-buttons button {
    background-color: #001c23;
    border: solid 1px rgb(99, 99, 99);
    color: white;
    padding: 4px 20px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .chart-toggle-buttons button:hover {
    background-color: steelblue;
  }

  .chart-toggle-buttons button.active {
    background-color: steelblue;
  }

  .year-labels {
    display: flex;
    justify-content: space-between;
    width: 100%;
    color: white;
    font-size: 12px;
  }

  :global(.rsPips) {
    margin-bottom: 10px !important;
  }
</style>
