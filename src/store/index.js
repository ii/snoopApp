import { readable, writable, derived } from 'svelte/store';
import {
  compact,
  groupBy,
  isEmpty,
  map,
  mapValues,
  orderBy,
  sortBy,
  take,
  uniq
} from 'lodash-es';

import {
  categoryColours,
  endpointColour,
  levelColours
} from '../lib/colours.js';

import { RELEASES } from '../lib/constants.js';

export const releases = writable(
  // Our list of RELEASES converted to object, with each release as key to empty object.
  mapValues(groupBy(RELEASES), () => ({
    release: '',
    spec: '',
    source: '',
    release_date: new Date(),
    endpoints: [],
    tests: []
  }))
);

// Based on url query params, any filters being set.
export const activeFilters = writable({
  test_tags: [],
  useragent: '',
  level: '',
  category: '',
  endpoint: '',
  version: ''
});

export const activeRelease = derived(
  // The release whose key is the current version filter,
  // (which will be set by our url)
  [releases, activeFilters],
  ([$r, $a], set) => {
    set($r[$a.version]);
  }
)

export const release = writable({
  release: '',
  spec: '',
  release_date: new Date(),
  endpoints: [],
  tests: []
});


// holds information on when user mouse is hovering over part of sunburst
export const mouseOverPath = writable([]);

export const breadcrumb = derived(
  [activeFilters, mouseOverPath],
  ([$active, $mouse], set) => {
    let mouseCrumbs = $mouse.map(m => m.data.name);
    let activeAndMouseCrumbs = compact(uniq([$active.level, $active.category, $active.endpo8, ...mouseCrumbs]));
    let crumbs = [];
    // if length is 4, it means we are zoomed into an endpoint, and hovering over a different endpoint.
    if (activeAndMouseCrumbs.length === 4) {
      // if that's the case, we want to show the one we are hovered on.
      crumbs = activeAndMouseCrumbs.filter(crumb => crumb !== $active.endpoint);
    } else {
      crumbs = take(compact(uniq([$active.level, $active.category, $active.endpoint, ...mouseCrumbs])), 3);
    }
    set(crumbs);
  }
);

export const endpoints = derived(activeRelease, ($rel, set) => {
  if ($rel) {
    set($rel.endpoints);
  } else {
    set([]);
  }
});

export const groupedEndpoints = derived(endpoints, ($eps, set) => {
  if ($eps.length > 0) {
    let epsByLevel = groupBy($eps, 'level');
    set(mapValues(epsByLevel, epsInLevel => {
      let epsByCategory = groupBy(epsInLevel, 'category');
      return mapValues(epsByCategory, epsInCategory => {
        return epsInCategory.map (ep => {
          return {
            ...ep,
            name: ep.endpoint,
            value: 1,
            color: endpointColour(ep)
          };
        });
      });
    }));
  } else {
    set({});
  }
});

export const sunburst = derived(groupedEndpoints, ($gep, set) => {
  if (!isEmpty($gep)) {
    var sunburst = {
      name: 'root',
      color: 'white',
      children: map($gep, (endpointsByCategoryAndEndpoint, level) => {
        return {
          name: level,
          color: levelColours[level] || levelColours['unused'],
          level: level,
          category: '',
          endpoint: '',
          children: map(endpointsByCategoryAndEndpoint, (endpointsByEndpoint, category) => {
            return {
              name: category,
              level: level,
              category: category,
              endpoint: '',
              color: categoryColours[category] ||  'rgba(183, 28, 28, 1)', // basic color so things compile right.
              children: sortBy(endpointsByEndpoint, [
                (endpoint) => endpoint.tested,
                (endpoint) => endpoint.conf_tested
              ])
            };
          })
        };
      })
    };
    sunburst.children = orderBy(sunburst.children, 'name', 'desc');
    set(sunburst);
  } else {
    set({});
  }
});

export const zoomedSunburst = derived(
  [sunburst, activeFilters],
  ([$sunburst, $filters], set) => {
    let { level, category } = $filters;
    if (!isEmpty($sunburst) && category) {
      let sunburstAtLevel = $sunburst.children.find(child => child.name === level);
      let sunburstAtCategory = sunburstAtLevel.children.find(child => child.name === category);
      set(sunburstAtCategory);
    } else if (!isEmpty($sunburst) && !category && level) {
      let sunburstAtLevel = $sunburst.children.find(child => child.name === level);
      set(sunburstAtLevel);
    } else {
      set($sunburst);
    }
  });

export const currentDepth = derived(breadcrumb, ($breadcrumb, set) => {
  let depths = ['root', 'level', 'category', 'endpoint'];
  let depth = $breadcrumb.length;
  set(depths[depth]);
});

export const coverageAtDepth = derived([breadcrumb, currentDepth, endpoints], ([$bc, $depth, $eps], set) => {
  let eps;
  if (isEmpty($eps)) {
    set({});
    return;
  } else if ($bc.length === 0) {
    eps = $eps;
  } else if ($bc.length === 1) {
    eps = $eps.filter(ep => ep.level === $bc[0]);
  } else if ($bc.length === 2) {
    eps = $eps.filter(ep => ep.level === $bc[0] && ep.category === $bc[1]);
  } else if ($bc.length === 3) {
    eps = $eps.filter(ep => ep.level === $bc[0] && ep.category === $bc[1] && ep.endpoint === $bc[2]);
  } else {
    eps = $eps;
  }
  let totalEndpoints = eps.length;
  let testedEndpoints = eps.filter(ep => ep.tested).length;
  let confTestedEndpoints = eps.filter(ep => ep.conf_tested).length;
  set({
    totalEndpoints,
    testedEndpoints,
    confTestedEndpoints
  });
});

export const endpointCoverage = derived([breadcrumb, currentDepth, endpoints], ([$bc, $cd, $eps], set) => {
  let currentEndpoint;
  let opId;
  let defaultCoverage = {
    tested: '',
    endpoint: '',
    confTested: '',
    description: '',
    path: '',
    group: '',
    version: '',
    kind: ''
  };
  if (isEmpty($eps) || $cd !== 'endpoint') {
    set(defaultCoverage);
  } else {
    opId = $bc[2];
    currentEndpoint = $eps.find(ep => ep.endpoint === opId);
    let {
      tested,
      conf_tested: confTested,
      endpoint,
      path,
      description,
      k8s_group: group,
      k8s_version: version,
      k8s_kind: kind
    } = currentEndpoint;
    set({
      tested,
      confTested,
      endpoint,
      path,
      description,
      group,
      version,
      kind
    });
  }
});
