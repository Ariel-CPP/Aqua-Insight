/* ==========================================================================
   AQUA INSIGHT - AQUACULTURE EXPERIMENTAL DESIGN SUPPORT
   Contains: CRD/RCBD Layout generators, Fisher-Yates randomizations,
   visual grid matrix mappers, and sample size power estimators.
   ========================================================================== */

window.AquaDesign = {
  // 1. Completely Randomized Design (CRD) Layout Generator
  // Penempatan perlakuan diacak secara penuh di seluruh tangki/kolam
  generateCRD: function(treatments, replications, rows, cols) {
    const totalUnits = treatments.length * replications;
    const requiredGrid = rows * cols;
    
    if (totalUnits > requiredGrid) {
      return { error: "Dimensi grid terlalu kecil untuk jumlah unit percobaan." };
    }
    
    // Create pool of treatments
    const pool = [];
    treatments.forEach((t, tIdx) => {
      for (let r = 0; r < replications; r++) {
        pool.push({
          treatment: t,
          tIdx,
          replication: r + 1
        });
      }
    });
    
    // Fill remaining grid units with empty space if any
    while (pool.length < requiredGrid) {
      pool.push({ treatment: "KOSONG", tIdx: -1, replication: 0 });
    }
    
    // Shuffle using Fisher-Yates algorithm
    this.shuffle(pool);
    
    // Map pool to 2D grid layout
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(pool[r * cols + c]);
      }
      grid.push(row);
    }
    
    return { grid, designType: "CRD" };
  },

  // 2. Randomized Complete Block Design (RCBD) Layout Generator
  // Pengacakan dilakukan di dalam blok (tiap baris atau kolom adalah blok utuh)
  generateRCBD: function(treatments, blocksCount, rows, cols) {
    // RCBD: treatments.length (t) per block. Total blocks = blocksCount (b).
    // Total units = t * b.
    const t = treatments.length;
    const b = blocksCount;
    
    if (t * b > rows * cols) {
      return { error: "Dimensi grid terlalu kecil untuk menampung seluruh blok." };
    }
    
    const grid = [];
    // Initialize empty grid layout of rows x cols
    for (let r = 0; r < rows; r++) {
      grid.push(new Array(cols).fill(null).map(() => ({ treatment: "KOSONG", tIdx: -1, block: 0 })));
    }
    
    // Assign each block.
    // For simplicity, we assign each block to consecutive rows/cols
    // Let's randomize treatments within each block
    for (let blockIdx = 0; blockIdx < b; blockIdx++) {
      const blockPool = treatments.map((tName, tIdx) => ({
        treatment: tName,
        tIdx,
        block: blockIdx + 1
      }));
      
      this.shuffle(blockPool);
      
      // Map block to grid coordinates
      // Place block units in grid left-to-right, top-to-bottom
      for (let i = 0; i < t; i++) {
        const globalIdx = blockIdx * t + i;
        const r = Math.floor(globalIdx / cols);
        const c = globalIdx % cols;
        
        if (r < rows && c < cols) {
          grid[r][c] = blockPool[i];
        }
      }
    }
    
    return { grid, designType: "RCBD", blocksCount: b };
  },

  // Fisher-Yates Shuffle
  shuffle: function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  // 3. Power Analysis & Sample Size interface
  calculateSampleSize: function(type, params) {
    // type: 'mean' or 'twomeans'
    if (type === "mean") {
      const alpha = params.alpha || 0.05;
      const power = params.power || 0.80;
      const sd = params.sd || 10.0;
      const margin = params.margin || 2.0;
      
      const n = window.AquaMath.sampleSizeMean(alpha, power, sd, margin);
      return {
        sampleSize: n,
        totalSampleSize: n,
        parameters: { alpha, power, sd, margin }
      };
    } else if (type === "twomeans") {
      const alpha = params.alpha || 0.05;
      const power = params.power || 0.80;
      const effectSize = params.effectSize || 0.5; // Cohens d
      const ratio = params.ratio || 1.0;
      
      const res = window.AquaMath.sampleSizeTwoMeans(alpha, power, effectSize, ratio);
      return {
        sampleSizeGroup1: res.n1,
        sampleSizeGroup2: res.n2,
        totalSampleSize: res.n1 + res.n2,
        parameters: { alpha, power, effectSize, ratio }
      };
    }
    return null;
  }
};
