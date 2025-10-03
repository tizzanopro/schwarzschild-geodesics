import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const SchwarzschildGeodesic = () => {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [energy, setEnergy] = useState(0.98);
  const [angularMomentum, setAngularMomentum] = useState(3.9);
  const [r0, setR0] = useState(8);
  const [maxSteps, setMaxSteps] = useState(3000);
  const [trajectories, setTrajectories] = useState([]);

  // Constantes
  const M = 1;
  const rs = 2 * M;

  // Équation de Binet: d²u/dφ² + u = M/L² + 3Mu²
  // où u = 1/r
  const d2u_dphi2 = (u, L) => {
    return M / (L * L) + 3 * M * u * u - u;
  };

  // Calcule (du/dφ)² à partir de l'énergie
  const duDphiSquared = (u, E, L) => {
    const r = 1 / u;
    const term = E * E - (1 - rs / r) * (1 + L * L * u * u);
    if (term < 0) return null;
    return (term / (L * L)) * (1 / (r * r * r * r));
  };

  // Calcule une trajectoire avec RK4 en utilisant u = 1/r
  const calculateTrajectory = (E, L, r_init, steps) => {
    const points = [];
    let u = 1 / r_init;
    let phi = 0;
    const dphi = 0.01;
    
    // Calcule du/dφ initial
    const du2_init = duDphiSquared(u, E, L);
    if (du2_init === null || du2_init < 0) {
      console.log("Conditions initiales invalides");
      return points;
    }
    
    // On commence en s'approchant (r diminue, donc u augmente)
    let v = Math.sqrt(du2_init);

    for (let i = 0; i < steps; i++) {
      const r = 1 / u;
      
      if (r < rs * 1.05 || r > 50 || isNaN(r) || isNaN(v)) break;
      
      points.push({ r, phi });
      
      // Runge-Kutta 4 pour {u, v} où v = du/dφ
      const k1_u = v;
      const k1_v = d2u_dphi2(u, L);
      
      const k2_u = v + 0.5 * dphi * k1_v;
      const k2_v = d2u_dphi2(u + 0.5 * dphi * k1_u, L);
      
      const k3_u = v + 0.5 * dphi * k2_v;
      const k3_v = d2u_dphi2(u + 0.5 * dphi * k2_u, L);
      
      const k4_u = v + dphi * k3_v;
      const k4_v = d2u_dphi2(u + dphi * k3_u, L);
      
      // Mise à jour
      u = u + (dphi / 6) * (k1_u + 2 * k2_u + 2 * k3_u + k4_u);
      v = v + (dphi / 6) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v);
      phi = phi + dphi;
    }

    console.log("Trajectoire:", points.length, "points");
    return points;
  };

  // Convertit coordonnées polaires en cartésiennes
  const polarToCartesian = (r, phi, centerX, centerY, scale) => {
    return {
      x: centerX + r * scale * Math.cos(phi),
      y: centerY + r * scale * Math.sin(phi)
    };
  };

  // Dessine la visualisation
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = 12;

    // Efface le canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Dessine les cercles de référence
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let r = 2; r <= 40; r += 2) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * scale, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Dessine le trou noir
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, rs * scale, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, rs * scale, 0, 2 * Math.PI);
    ctx.stroke();

    // ISCO
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6 * M * scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Photon sphere
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3 * M * scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dessine les trajectoires
    trajectories.forEach((traj, idx) => {
      if (traj.points.length < 2) return;

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      const colors = ['#00d4ff', '#00ff88', '#ffdd00', '#ff00ff', '#ff4444'];
      gradient.addColorStop(0, colors[idx % colors.length]);
      gradient.addColorStop(1, colors[(idx + 1) % colors.length]);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const firstPoint = polarToCartesian(traj.points[0].r, traj.points[0].phi, centerX, centerY, scale);
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < traj.points.length; i++) {
        const point = polarToCartesian(traj.points[i].r, traj.points[i].phi, centerX, centerY, scale);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();

      // Point de départ
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Légende
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Horizon (rs = ${rs.toFixed(1)}M)`, 10, 20);
    ctx.fillText(`ISCO (r = 6M)`, 10, 40);
    ctx.fillText(`Photon sphere (r = 3M)`, 10, 60);
    ctx.fillText(`E = ${energy.toFixed(3)}`, 10, 85);
    ctx.fillText(`L = ${angularMomentum.toFixed(2)}M`, 10, 105);
    ctx.fillText(`Points: ${trajectories.reduce((sum, t) => sum + t.points.length, 0)}`, 10, 125);
  };

  const reset = () => {
    setTrajectories([]);
    setIsRunning(false);
  };

  const addTrajectory = () => {
    const points = calculateTrajectory(energy, angularMomentum, r0, maxSteps);
    if (points.length > 0) {
      setTrajectories(prev => [...prev, { points, E: energy, L: angularMomentum }]);
    } else {
      alert("Impossible de calculer cette trajectoire. Essayez d'augmenter E ou L.");
    }
  };

  useEffect(() => {
    draw();
  }, [trajectories, energy, angularMomentum, r0, maxSteps]);

  useEffect(() => {
    if (isRunning) {
      addTrajectory();
      setIsRunning(false);
    }
  }, [isRunning]);

  return (
    <div className="w-full min-h-screen bg-gray-900 flex flex-col items-center justify-start p-4 py-8">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-4xl w-full mb-8">
        <h1 className="text-3xl font-bold text-white mb-4 text-center">
          Géodésiques dans la métrique de Schwarzschild
        </h1>
        
        <canvas
          ref={canvasRef}
          width={550}
          height={550}
          className="border-2 border-gray-700 rounded-lg mb-4 mx-auto bg-black"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white text-sm mb-2 block">
              Énergie E: {energy.toFixed(3)}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0.85"
                max="1.15"
                step="0.001"
                value={energy}
                onChange={(e) => setEnergy(parseFloat(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="0.85"
                max="1.15"
                step="0.001"
                value={energy}
                onChange={(e) => setEnergy(parseFloat(e.target.value) || 0.85)}
                className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm mb-2 block">
              Moment angulaire L: {angularMomentum.toFixed(2)}M
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="3"
                max="6"
                step="0.05"
                value={angularMomentum}
                onChange={(e) => setAngularMomentum(parseFloat(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="3"
                max="6"
                step="0.05"
                value={angularMomentum}
                onChange={(e) => setAngularMomentum(parseFloat(e.target.value) || 3)}
                className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm mb-2 block">
              Position initiale r₀: {r0.toFixed(1)}M
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="3"
                max="15"
                step="0.5"
                value={r0}
                onChange={(e) => setR0(parseFloat(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="3"
                max="15"
                step="0.5"
                value={r0}
                onChange={(e) => setR0(parseFloat(e.target.value) || 3)}
                className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm mb-2 block">
              Nombre de pas: {maxSteps}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="500"
                max="20000"
                step="100"
                value={maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="500"
                max="20000"
                step="100"
                value={maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value) || 500)}
                className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => setIsRunning(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Play size={20} />
            Tracer géodésique
          </button>

          <button
            onClick={reset}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <RotateCcw size={20} />
            Réinitialiser
          </button>
        </div>

        <div className="mt-4 text-gray-300 text-sm bg-gray-700 p-4 rounded">
          <p className="font-semibold mb-2">Configurations intéressantes:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Orbite elliptique stable:</strong> E = 0.98, L = 3.9, r₀ = 8M, pas = 3000</li>
            <li><strong>Orbite circulaire:</strong> E = 0.94, L = 4.5, r₀ = 10M, pas = 2000</li>
            <li><strong>Précession (comme Mercure):</strong> E = 0.96, L = 4.2, r₀ = 9M, pas = 5000</li>
            <li><strong>Passage hyperbolique:</strong> E = 1.05, L = 4.5, r₀ = 12M, pas = 2000</li>
            <li><strong>Spirale entrante:</strong> E = 0.90, L = 3.5, r₀ = 8M, pas = 1500</li>
            <li>Augmentez le nombre de pas pour voir plus de révolutions</li>
            <li>L'équation utilisée: d²u/dφ² + u = M/L² + 3Mu² (Binet)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SchwarzschildGeodesic;
