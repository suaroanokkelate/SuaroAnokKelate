import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SOSRequest, GeoLocation, SOSStatus } from '../types';

interface RadarViewProps {
  requests: SOSRequest[];
  myLocation: GeoLocation | null;
  mySOSId?: string;
}

const RadarView: React.FC<RadarViewProps> = ({ requests, myLocation, mySOSId }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !myLocation) return;

    const width = svgRef.current.clientWidth;
    const height = 300;
    const center = { x: width / 2, y: height / 2 };
    const maxRadius = Math.min(width, height) / 2 - 20;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Draw Radar Circles
    const rings = [0.33, 0.66, 1];
    rings.forEach(r => {
      svg.append("circle")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", maxRadius * r)
        .attr("fill", "none")
        .attr("stroke", "rgba(59, 130, 246, 0.3)")
        .attr("stroke-width", 1);
    });

    // Draw Crosshairs
    svg.append("line")
      .attr("x1", center.x)
      .attr("y1", center.y - maxRadius)
      .attr("x2", center.x)
      .attr("y2", center.y + maxRadius)
      .attr("stroke", "rgba(59, 130, 246, 0.2)");
    
    svg.append("line")
      .attr("x1", center.x - maxRadius)
      .attr("y1", center.y)
      .attr("x2", center.x + maxRadius)
      .attr("y2", center.y)
      .attr("stroke", "rgba(59, 130, 246, 0.2)");

    // User Dot (Center)
    svg.append("circle")
      .attr("cx", center.x)
      .attr("cy", center.y)
      .attr("r", 8)
      .attr("fill", "#3B82F6")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    svg.append("text")
      .attr("x", center.x)
      .attr("y", center.y + 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#3B82F6")
      .attr("font-size", "10px")
      .text("YOU");

    // Plot SOS Signals
    const range = 0.01; // Approx 1km range for the radar view demo

    requests.forEach(req => {
      if (!req.location) return;

      const dLat = req.location.lat - myLocation.lat;
      const dLng = req.location.lng - myLocation.lng;

      // Normalize to circle
      const x = center.x + (dLng / range) * maxRadius;
      const y = center.y - (dLat / range) * maxRadius; // Y is inverted in SVG

      // Clamp to view
      const isInside = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2)) <= maxRadius;
      
      if (isInside) {
        const isMe = req.id === mySOSId;
        
        // Determine Color
        // Status Priority: Safe/Rescued takes precedence over priority for visual clarity
        let mainColor = "#EF4444"; // Red (Active Default)
        let rippleColor = "rgba(239, 68, 68, 0.3)";
        let rippleFade = "rgba(239, 68, 68, 0.1)";
        let label = "SOS";

        if (req.status === SOSStatus.SAFE) {
          mainColor = "#64748B"; // Slate-500
          rippleColor = "transparent";
          rippleFade = "transparent";
          label = "SAFE";
        } else if (req.status === SOSStatus.RESCUED) {
          mainColor = "#3B82F6"; // Blue-500
          rippleColor = "rgba(59, 130, 246, 0.2)";
          rippleFade = "transparent";
          label = "OK";
        } else if (req.isMedicalEmergency) {
          mainColor = "#9333EA"; // Purple-600
          rippleColor = "rgba(147, 51, 234, 0.3)";
          rippleFade = "rgba(147, 51, 234, 0.1)";
          label = "MED";
        } else if (isMe) {
          mainColor = "#10B981"; // Green-500
          rippleColor = "rgba(16, 185, 129, 0.3)";
          rippleFade = "rgba(16, 185, 129, 0.1)";
          label = "ME";
        }

        // Ripple effect (Only for active or rescued)
        if (req.status !== SOSStatus.SAFE) {
            svg.append("circle")
              .attr("cx", x)
              .attr("cy", y)
              .attr("r", 15)
              .attr("fill", rippleColor)
              .append("animate")
              .attr("attributeName", "r")
              .attr("from", "5")
              .attr("to", "20")
              .attr("dur", "1.5s")
              .attr("repeatCount", "indefinite");
            
            svg.append("circle")
              .attr("cx", x)
              .attr("cy", y)
              .attr("r", 15)
              .attr("fill", rippleFade)
              .append("animate")
              .attr("attributeName", "opacity")
              .attr("values", "1;0")
              .attr("dur", "1.5s")
              .attr("repeatCount", "indefinite");
        }

        if (isMe) {
          // Draw Star for User
          const star = d3.symbol().type(d3.symbolStar).size(200);
          svg.append("path")
             .attr("d", star)
             .attr("transform", `translate(${x},${y})`)
             .attr("fill", mainColor)
             .attr("stroke", "#fff")
             .attr("stroke-width", 1.5);
        } else {
          // Draw Circle for Others
          svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 6)
            .attr("fill", mainColor)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
        }
          
        // Label
        svg.append("text")
          .attr("x", x)
          .attr("y", y - 12)
          .attr("text-anchor", "middle")
          .attr("fill", mainColor)
          .attr("font-size", "9px")
          .attr("font-weight", "bold")
          .text(label);
      }
    });

  }, [requests, myLocation, mySOSId]);

  return (
    <div className="w-full bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700 relative">
       <div className="absolute top-2 left-2 text-xs text-slate-400 font-mono">RADAR SCANNER (1KM)</div>
      <svg ref={svgRef} className="w-full h-[300px]"></svg>
      {!myLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-white">
          <p className="animate-pulse">Waiting for GPS...</p>
        </div>
      )}
    </div>
  );
};

export default RadarView;