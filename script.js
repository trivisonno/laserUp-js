// Numeral points for drawing digits
const numeral_points = {
    '0': [[0,0], [25,0], [25,50], [0,50], [0,0]],
    '1': [[25,0], [25,50]],
    '2': [[0,0], [25,0], [25,25], [0,25], [0, 50], [25,50]],
    '3': [[0,0], [25,0], [25,25], [10,25], [25,25], [25, 50], [0,50]],
    '4': [[0,0], [0, 25], [25,25], [25,0], [25,50]],
    '5': [[25,0], [0, 0], [0,25], [25,25], [25,50], [0, 50]],
    '6': [[0, 0], [0,25], [25,25], [25,50], [0, 50], [0, 25]],
    '7': [[0,0], [25, 0], [25,50]],
    '8': [[0, 25], [25,25], [25,0], [0,0], [0,50], [25,50], [25,25]],
    '9': [[25,50], [25,0], [0,0], [0, 25], [25,25]],
  };
  
  // Function to linearly interpolate lists of numbers
  function linear_interpolate(list_of_lists) {
    const result = [];
    for (let i = 0; i < list_of_lists[0].length; i++) {
      let sum = 0;
      for (let j = 0; j < list_of_lists.length; j++) {
        sum += list_of_lists[j][i];
      }
      result.push(sum / list_of_lists.length);
    }
    return result;
  }
  
  // Parse elevation data from JSON
  function parseElevationData(data, material_height_mm=1.0, design_width_mm=200.0, land_only=false) {
    let pos = 0;
    let landRows = 0;
    let rows = [];
    for (let row = 0; row < data.windowHeight; row++) {
      let hasLand = false;
      let rowData = [];
      for (let col = 0; col < data.windowWidth; col++) {
        const height = data.allHeights[pos.toString()];
        rowData.push(height);
        if (height > 0) {
          hasLand = true;
        }
        pos +=1;
      }
      if (hasLand) {
        landRows +=1;
      }
      if (!land_only || hasLand) {
        rows.push(rowData);
      }
    }
    console.log(`Source rows containing land: ${landRows} of ${data.windowHeight}`);
    // interpolate to maintain aspect ratio of the data
    const aspect_ratio = data.windowWidth / data.windowHeight;
    let desired_slices = design_width_mm / (material_height_mm * aspect_ratio);
    console.log(`Source total slices at this thickness before considering interpolation: ${desired_slices}`);
    let interpolate_slice_count = Math.round(data.windowHeight / desired_slices);
    if (interpolate_slice_count < 1) {
      interpolate_slice_count = 1;
      desired_slices = data.windowHeight;
    } else {
      desired_slices = data.windowHeight / interpolate_slice_count;
    }
    console.log(`Source total slices at this thickness after interpolation: ${desired_slices}`);
    console.log(`Interpolating every: ${interpolate_slice_count}`);
    let retrows = [];
    while (rows.length > 0) {
      let irows = [];
      for (let z = 0; z < interpolate_slice_count && rows.length > 0; z++) {
        irows.push(rows.shift());
      }
      retrows.push(linear_interpolate(irows));
    }
    console.log(`Total slices: ${retrows.length}`);
    return { rows: retrows, data };
  }
  
  // Class to generate SVG elements
  class SVGGenerator {
    constructor(row_data, data, design_width_mm=200, max_height_mm=60) {
      this._max_height_px = max_height_mm * 10; // Conversion factor
      this._row_data = row_data;
      this._data = data;
      this._scale = this._max_height_px / data.maxHeight;
      this._vspacing_px = 10;
      this._workspace_height_px = 3000;
      this._workspace_width_px = 5000;
      this._design_width_px = design_width_mm * (this._workspace_width_px / 400.0);
    }
  
    generateSVGFiles(row_nums) {
      let y_offset = 0;
      let x_offset = 0;
      let svgFiles = [];
      let current_file_num = 0;
  
      let svgDoc = this.createSVGElement();
      let elementsGroup = [];
  
      for (let i = 0; i < row_nums.length; i++) {
        const rn = row_nums[i];
        const { elements, yadjust } = this.svg(rn, y_offset, x_offset);
        elementsGroup = elementsGroup.concat(elements);
        y_offset = y_offset + 100 + this._max_height_px + this._vspacing_px - yadjust;
        if (y_offset + (100 + this._max_height_px - yadjust) > this._workspace_height_px) {
          if (x_offset + this._design_width_px * 2 > this._workspace_width_px) {
            // Save current SVG
            svgDoc.append(...elementsGroup);
            const svgString = this.serializeSVG(svgDoc);
            svgFiles.push({ filename: `map_${current_file_num.toString().padStart(4, '0')}.svg`, content: svgString });
            // Start new SVG
            current_file_num += 1;
            svgDoc = this.createSVGElement();
            elementsGroup = [];
            x_offset = 0;
          } else {
            x_offset += this._design_width_px;
          }
          y_offset = 0;
        }
      }
      // Append remaining elements
      if (elementsGroup.length > 0) {
        svgDoc.append(...elementsGroup);
        const svgString = this.serializeSVG(svgDoc);
        svgFiles.push({ filename: `map_${current_file_num.toString().padStart(4, '0')}.svg`, content: svgString });
      }
  
      return svgFiles;
    }
  
    createSVGElement() {
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute('width', '40.0cm');
      svg.setAttribute('height', '25.0cm');
      svg.setAttribute('viewBox', '0 0 5000 3125');
      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('version', '1.1');
      return svg;
    }
  
    svg(row_num, y_offset=0, x_offset=0) {
      const DEPTH = this._max_height_px + 100;
      const WIDTH = this._design_width_px;
      const row = this._row_data[row_num];
      const max_height = Math.max(...row);
      const max_scaled = max_height * this._scale;
      y_offset = y_offset - (this._max_height_px - max_scaled);
      const points = [
        [0 + x_offset, DEPTH + y_offset],
        [0 + x_offset, DEPTH - 100 + y_offset]
      ];
      const step = WIDTH / row.length;
      let curr = 0.0;
      for (let i = 0; i < row.length; i++) {
        const point = row[i];
        points.push([x_offset + curr, y_offset + DEPTH - 100 - (point * this._scale)]);
        curr += step;
      }
      points.push([x_offset + WIDTH, y_offset + DEPTH - 100]);
      points.push([x_offset + WIDTH, y_offset + DEPTH]);
  
      const pointsString = points.map(([a, b]) => `${a},${b}`).join(' ');
      const svgNS = "http://www.w3.org/2000/svg";
  
      // Create polygon element
      const polygonEl = document.createElementNS(svgNS, 'polygon');
      polygonEl.setAttribute('points', pointsString);
      polygonEl.setAttribute('fill', 'none');
      polygonEl.setAttribute('stroke', 'blue');
  
      // Create number elements
      const numberElements = this.createNumberSVGElements(row_num, x_offset + 400, y_offset + DEPTH - 80);
  
      // Create circle elements
      const circle1 = document.createElementNS(svgNS, 'circle');
      circle1.setAttribute('cx', (100 + x_offset).toString());
      circle1.setAttribute('cy', (DEPTH - 50 + y_offset).toString());
      circle1.setAttribute('r', '40');
      circle1.setAttribute('fill', 'none');
      circle1.setAttribute('stroke', 'blue');
  
      const circle2 = document.createElementNS(svgNS, 'circle');
      circle2.setAttribute('cx', (2400 + x_offset).toString());
      circle2.setAttribute('cy', (DEPTH - 50 + y_offset).toString());
      circle2.setAttribute('r', '40');
      circle2.setAttribute('fill', 'none');
      circle2.setAttribute('stroke', 'blue');
  
      const elements = [polygonEl, circle1, circle2].concat(numberElements);
  
      return { elements, yadjust: (this._max_height_px - max_scaled) };
    }
  
    createNumberSVGElements(num, xo, yo) {
      const svgNS = "http://www.w3.org/2000/svg";
      const elements = [];
      const s = num.toString();
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const digitPoints = numeral_points[ch].map(([a, b]) => `${a + xo},${b + yo}`).join(' ');
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', digitPoints);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', 'red');
        elements.push(polyline);
        xo += 60;
      }
      return elements;
    }
  
    serializeSVG(svgElement) {
      const serializer = new XMLSerializer();
      const source = '<?xml version="1.0" standalone="no"?>\r\n' +
                     '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
                     '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n' +
                     serializer.serializeToString(svgElement);
      return source;
    }
  }
  
  // Event listener for Generate SVGs button
  document.getElementById('generate-button').addEventListener('click', function() {
    const jsonFileInput = document.getElementById('json-file');
    const thickness_mm = parseFloat(document.getElementById('thickness-mm').value);
    const max_height_mm = parseFloat(document.getElementById('max-height-mm').value);
    const land_only = document.getElementById('land-only').checked;
  
    if (jsonFileInput.files.length === 0) {
      alert('Please select a JSON file.');
      return;
    }
  
    const file = jsonFileInput.files[0];
    const reader = new FileReader();
  
    reader.onload = function(e) {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch (err) {
        alert('Invalid JSON file.');
        return;
      }
  
      const { rows, data: elevationData } = parseElevationData(data, thickness_mm, 200.0, land_only);
      const svgGenerator = new SVGGenerator(rows, elevationData, 200, max_height_mm);
      const row_nums = rows.map((_, idx) => idx);
      const svgFiles = svgGenerator.generateSVGFiles(row_nums);
  
      // Prepare ZIP file
      const zip = new JSZip();
      svgFiles.forEach(file => {
        zip.file(file.filename, file.content);
      });
  
      zip.generateAsync({ type: 'blob' }).then(function(content) {
        // Offer the zip file for download
        const url = URL.createObjectURL(content);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'maps.zip';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
      });
  
      document.getElementById('download-button').style.display = 'none';
      alert('SVG files have been zipped and are ready for download.');
    };
  
    reader.readAsText(file);
  });