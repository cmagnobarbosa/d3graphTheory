"use strict";
//node ids are in order in which nodes come in existence
var nodes = [
  { id: 1, degree: 2 },
  { id: 2, degree: 2 },
  { id: 3, degree: 2 },

  { id: 4, degree: 1 },
  { id: 5, degree: 1 },

  { id: 6, degree: 4 },
  { id: 7, degree: 3 },
  { id: 8, degree: 3 },
  { id: 9, degree: 3 },
  { id: 10, degree: 3 }
];

var links = [
  { source: 0, target: 1 },
  { source: 1, target: 2 },
  { source: 2, target: 0 },

  { source: 3, target: 4 },

  { source: 5, target: 6 },
  { source: 5, target: 7 },
  { source: 5, target: 8 },
  { source: 5, target: 9 },
  { source: 6, target: 7 },
  { source: 7, target: 8 },
  { source: 8, target: 9 },
  { source: 9, target: 6 }
];

var walk = [];

//universal width and height let index.html control svg dimensions when needed
var lastNodeId = nodes.length,
  componentCount = 0;

var w = univSvgWidth ? univSvgWidth : 616,
  h = univSvgHeight ? univSvgHeight : 400,
  rad = 10;

positionNodes();
setWalkDegree();

var svg = d3
  .select("#svg-wrap")
  .append("svg")
  .attr("width", w)
  .attr("height", h);

var dragLine = svg
  .append("path")
  .attr("class", "dragLine hidden")
  .attr("d", "M0,0L0,0");

var edges = svg.append("g").selectAll(".edge");

var vertices = svg.append("g").selectAll(".vertex");

var force = d3
  .forceSimulation()
  .force(
    "charge",
    d3
      .forceManyBody()
      .strength(-300)
      .distanceMax((w + h) / 2)
  )
  .force(
    "link",
    d3
      .forceLink()
      .distance(60)
      .strength(0.95)
  )
  .force("x", d3.forceX(w / 2).strength(0.1))
  .force("y", d3.forceY(h / 2).strength(0.1))
  .on("tick", tick);

force.nodes(nodes);
force.force("link").links(links);

var colors = d3.schemeCategory10;
var mousedownNode = null;

d3.select("#clear-graph").on("click", clearGraph);
d3.select("#clear-walk").on("click", clearWalk);
d3.select("#reverse-walk").on("click", reverseWalk);

//empties the graph
function clearGraph() {
  clearWalk();
  nodes.splice(0);
  links.splice(0);
  lastNodeId = 0;
  restart();
  checkConnectivity();
}

//set initial positions for quick convergence
function positionNodes() {
  nodes.forEach(function(d, i) {
    d.x = d.y = (w / lastNodeId) * i;
  });
}

function setWalkDegree() {
  nodes.forEach(function(v) {
    v.walkDegree = 0;
  });
}

//update the simulation
function tick() {
  edges
    .attr("x1", function(d) {
      return d.source.x;
    })
    .attr("y1", function(d) {
      return d.source.y;
    })
    .attr("x2", function(d) {
      return d.target.x;
    })
    .attr("y2", function(d) {
      return d.target.y;
    });

  //here vertices are g.vertex elements
  vertices.attr("transform", function(d) {
    return "translate(" + d.x + "," + d.y + ")";
  });
}

function addNode() {
  var e = d3.event;
  if (e.button == 0) {
    var coords = d3.mouse(e.currentTarget);
    var newNode = {
      x: coords[0],
      y: coords[1],
      id: ++lastNodeId,
      degree: 0,
      walkDegree: 0
    };
    nodes.push(newNode);
    restart();
    checkConnectivity();
  }
}

//d is data, i is index according to selection
function removeNode(d, i) {
  var e = d3.event;
  //to make ctrl-drag works for mac/osx users
  if (e.ctrlKey) return;
  if (d3.select(e.currentTarget).classed("walk-vertex")) return;
  var linksToRemove = links.filter(function(l) {
    return l.source === d || l.target === d;
  });
  linksToRemove.map(function(l) {
    l.source.degree--;
    l.target.degree--;
    links.splice(links.indexOf(l), 1);
  });
  nodes.splice(nodes.indexOf(d), 1);
  e.preventDefault();
  restart();
  checkConnectivity();
}

function removeEdge(d, i) {
  var e = d3.event;
  if (d3.select(e.currentTarget).classed("walk-edge")) return;
  d.source.degree--;
  d.target.degree--;
  links.splice(links.indexOf(d), 1);
  e.preventDefault();
  restart();
  checkConnectivity();
}

function beginDragLine(d) {
  var e = d3.event;
  //stop propagation at .vertex so that addNode isn't fired
  e.stopPropagation();
  //to prevent dragging of svg in firefox
  e.preventDefault();
  if (e.ctrlKey || e.button != 0) return;
  mousedownNode = d;
  dragLine
    .classed("hidden", false)
    .attr(
      "d",
      "M" +
        mousedownNode.x +
        "," +
        mousedownNode.y +
        "L" +
        mousedownNode.x +
        "," +
        mousedownNode.y
    );
}

function updateDragLine() {
  if (!mousedownNode) return;
  var coords = d3.mouse(d3.event.currentTarget);
  dragLine.attr(
    "d",
    "M" +
      mousedownNode.x +
      "," +
      mousedownNode.y +
      "L" +
      coords[0] +
      "," +
      coords[1]
  );
}

function hideDragLine() {
  dragLine.classed("hidden", true);
  mousedownNode = null;
  restart();
}

//no need to call hideDragLine in endDragLine
//mouseup on vertices propagates to svg which calls hideDragLine
function endDragLine(d) {
  if (!mousedownNode || mousedownNode === d) return;
  //return if link already exists
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    if (
      (l.source === mousedownNode && l.target === d) ||
      (l.source === d && l.target === mousedownNode)
    ) {
      return;
    }
  }
  mousedownNode.degree++;
  d.degree++;
  var newLink = { source: mousedownNode, target: d };
  links.push(newLink);
  checkConnectivity();
}

//one response per ctrl keydown
var lastKeyDown = -1;

function keydown() {
  d3.event.preventDefault();
  if (lastKeyDown !== -1) return;
  lastKeyDown = d3.event.key;

  if (lastKeyDown === "Control") {
    vertices.call(
      d3
        .drag()
        .on("start", function dragstarted(d) {
          if (!d3.event.active) force.alphaTarget(1).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", function(d) {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        })
        .on("end", function(d) {
          if (!d3.event.active) force.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );
  }
}

function keyup() {
  lastKeyDown = -1;
  if (d3.event.key === "Control") {
    vertices.on("mousedown.drag", null);
  }
}

//updates the graph by updating links, nodes and binding them with DOM
//interface is defined through several events
function restart() {
  edges = edges.data(links, function(d) {
    return "v" + d.source.id + "-v" + d.target.id;
  });
  edges.exit().remove();

  var ed = edges
    .enter()
    .append("line")
    .attr("class", "edge")
    .on("mousedown", function() {
      d3.event.stopPropagation();
    })
    .on("click", extendWalk)
    .on("contextmenu", removeEdge);

  ed.append("title").text(function(d) {
    return "v" + d.source.id + "-v" + d.target.id;
  });

  edges = ed.merge(edges);

  //vertices are known by id
  vertices = vertices.data(nodes, function(d) {
    return d.id;
  });
  vertices.exit().remove();

  var ve = vertices
    .enter()
    .append("circle")
    .attr("r", rad)
    .attr("class", "vertex")
    .attr("id", function(d) {
      return "v" + d.id;
    })
    .style("fill", function(d, i) {
      //default silver color
      return "#ccc";
    })
    .on("mousedown", beginDragLine)
    .on("mouseup", endDragLine)
    .on("contextmenu", removeNode);

  ve.append("title").text(function(d) {
    return "v" + d.id;
  });

  vertices = ve.merge(vertices);

  force.nodes(nodes);
  force.force("link").links(links);
  force.alpha(0.3).restart();
}

//further interface
svg
  .on("mousedown", addNode)
  .on("mousemove", updateDragLine)
  .on("mouseup", hideDragLine)
  .on("contextmenu", function() {
    d3.event.preventDefault();
  })
  .on("mouseleave", hideDragLine);

d3.select(window)
  .on("keydown", keydown)
  .on("keyup", keyup);

restart();
checkConnectivity();

//managing walk

function extendWalk(d) {
  var thisEdge = d3.select(d3.event.currentTarget),
    sourceVertex = d3.select("#v" + d.source.id),
    targetVertex = d3.select("#v" + d.target.id);

  //remove the last added edge
  if (thisEdge.classed("walk-edge")) {
    if (walk.length == 1 && walk[0] === d) {
      clearWalk();
      return;
    }

    if (walk.length > 1 && walk[walk.length - 1] === d) {
      walk.pop();
      thisEdge.classed("walk-edge", false);

      if (sourceVertex.classed("walk-end")) {
        sourceVertex.classed("walk-end", false);
        if (d.source.walkDegree == 1) {
          sourceVertex.classed("walk-vertex", false);
        }
        targetVertex.classed("walk-end", true);
      } else if (targetVertex.classed("walk-end")) {
        targetVertex.classed("walk-end", false);
        if (d.target.walkDegree == 1) {
          targetVertex.classed("walk-vertex", false);
        }
        sourceVertex.classed("walk-end", true);
      }

      d.source.walkDegree--;
      d.target.walkDegree--;
    }
    return;
  }

  //add edge
  if (walk.length == 0) {
    walk.push(d);
    thisEdge.classed("walk-edge", true);
    sourceVertex.classed("walk-start walk-vertex", true);
    targetVertex.classed("walk-end walk-vertex", true);
    d.source.walkDegree++;
    d.target.walkDegree++;
  } else if (sourceVertex.classed("walk-end")) {
    walk.push(d);
    thisEdge.classed("walk-edge", true);
    sourceVertex.classed("walk-end", false);
    targetVertex.classed("walk-end walk-vertex", true);
    d.source.walkDegree++;
    d.target.walkDegree++;
  } else if (targetVertex.classed("walk-end")) {
    walk.push(d);
    thisEdge.classed("walk-edge", true);
    targetVertex.classed("walk-end", false);
    sourceVertex.classed("walk-end walk-vertex", true);
    d.source.walkDegree++;
    d.target.walkDegree++;
  }
}

function clearWalk() {
  d3.selectAll(".walk-edge").classed("walk-edge", false);
  d3.selectAll(".walk-vertex").classed("walk-vertex", false);
  d3.select(".walk-start").classed("walk-start", false);
  d3.select(".walk-end").classed("walk-end", false);
  walk.splice(0);
  setWalkDegree();
}

function reverseWalk() {
  if (walk.length == 0) return;
  walk.reverse();
  var currentStart = d3.select(".walk-start");
  var currentEnd = d3.select(".walk-end");
  if (currentStart.attr("id") != currentEnd.attr("id")) {
    currentStart.classed("walk-start", false);
    currentStart.classed("walk-end", true);
    currentEnd.classed("walk-start", true);
    currentEnd.classed("walk-end", false);
  }
}

function checkConnectivity() {
  if (nodes.length == 0) {
    componentCount = 0;
    showGraphLatex();
    return;
  }

  componentCount = 1;
  nodes.forEach(function(v) {
    v.visited = false;
  });

  //construct adjacency list of graph
  var adjList = {};
  nodes.forEach(function(v) {
    adjList[v.id] = [];
  });
  links.forEach(function(e) {
    adjList[e.source.id].push(e.target);
    adjList[e.target.id].push(e.source);
  });

  //perform DFS on nodes
  var q = [];
  q.push(nodes[0]);

  while (q.length > 0) {
    var v1 = q.shift();
    var adj = adjList[v1.id];

    for (let i = 0; i < adj.length; i++) {
      var v2 = adj[i];
      if (v2.visited) continue;
      q.push(v2);
    }

    v1.visited = true;
    v1.componentId = componentCount;
    //check for unvisited nodes
    if (q.length == 0) {
      for (let i = 0; i < nodes.length; i++) {
        if (!nodes[i].visited) {
          q.push(nodes[i]);
          componentCount++;
          break;
        }
      }
    }
  } //while ends here

  vertices.style("fill", function(d) {
    return colors[d.componentId % 10];
  });
  showGraphLatex();
}

//prints latex in svg-output
function showGraphLatex() {
  var l = "";
  if (componentCount == 0) l = "\\[\\text{Draw something.}\\]";
  else if (componentCount == 1)
    l =
      "\\[\\text{Existe apenas um componente conectado neste grafo. Portanto, o grafo está conectado.}\\]";
  else
    l =
      "\\[\\text{Existe " +
      componentCount +
      " componentes conectado neste grafo. Portanto, temos um um grafo desconectado.}\\]";

  document.getElementById("svg-output").textContent = l;
  //recall mathjax
  MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
}
