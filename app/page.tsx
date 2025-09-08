'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart } from 'recharts'

const SmartChargingDashboard = () => {
  // State management
  const [chargerType, setChargerType] = useState('Level 2')
  const [batteryCapacity, setBatteryCapacity] = useState(75)
  const [currentCharge, setCurrentCharge] = useState(20)
  const [targetCharge, setTargetCharge] = useState(80)
  const [earliestStart, setEarliestStart] = useState('06:00')
  const [latestEnd, setLatestEnd] = useState('22:00')
  const [v2gEnabled, setV2gEnabled] = useState(true)
  const [priceThreshold, setPriceThreshold] = useState(0.25)
  const [simulationSpeed, setSimulationSpeed] = useState(1)

  // Enhanced charger specifications with colors
  const chargerSpecs = {
    'Level 1': { power: 1.4, efficiency: 0.85, cost: 0.1, color: '#10B981', bgColor: 'bg-emerald-50' },
    'Level 2': { power: 7.2, efficiency: 0.90, cost: 0.15, color: '#3B82F6', bgColor: 'bg-blue-50' },
    'DC Fast': { power: 50, efficiency: 0.95, cost: 0.35, color: '#F59E0B', bgColor: 'bg-amber-50' },
    'Tesla Supercharger': { power: 120, efficiency: 0.92, cost: 0.45, color: '#EF4444', bgColor: 'bg-red-50' }
  }

  // Generate realistic hourly data that responds to inputs
  const generateHourlyData = () => {
    const basePrice = 0.08 + (simulationSpeed * 0.02)
    const data = []

    for (let hour = 0; hour < 24; hour++) {
      // Enhanced demand simulation based on user inputs
      let demandMultiplier = 1
      const startHour = parseInt(earliestStart.split(':')[0])
      const endHour = parseInt(latestEnd.split(':')[0])

      // Peak demand during user's preferred times affects pricing
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
        demandMultiplier = 2.2 + Math.random() * 0.8
      } else if (hour >= startHour && hour <= endHour) {
        demandMultiplier = 1.3 + Math.random() * 0.4
      } else {
        demandMultiplier = 0.5 + Math.random() * 0.3
      }

      // Battery capacity affects grid impact
      const gridImpact = Math.min(2, batteryCapacity / 75)
      const price = basePrice * demandMultiplier * gridImpact
      const demand = demandMultiplier * 85

      // V2G rate based on current settings
      const v2gRate = (price > priceThreshold && v2gEnabled) ? price * 0.88 : 0

      // Grid load influenced by charger type
      const chargerImpact = chargerSpecs[chargerType].power / 50
      const gridLoad = 55 + (demandMultiplier - 1) * 35 * chargerImpact + Math.random() * 8

      // Renewable energy availability
      const renewable = Math.max(5, 85 - Math.abs(13 - hour) * 4 + Math.random() * 25)

      // Carbon intensity (lower when more renewable)
      const carbonIntensity = Math.max(50, 400 - renewable * 3 + Math.random() * 50)

      data.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        price: Number(price.toFixed(3)),
        demand: Number(demand.toFixed(1)),
        v2gRate: Number(v2gRate.toFixed(3)),
        gridLoad: Number(gridLoad.toFixed(1)),
        renewable: Number(renewable.toFixed(1)),
        carbonIntensity: Number(carbonIntensity.toFixed(0)),
        savings: price < basePrice ? Number(((basePrice - price) * chargerSpecs[chargerType].power).toFixed(2)) : 0
      })
    }
    return data
  }

  const [hourlyData, setHourlyData] = useState(() => generateHourlyData())

  // Regenerate data when inputs change
  useEffect(() => {
    setHourlyData(generateHourlyData())
  }, [chargerType, batteryCapacity, earliestStart, latestEnd, v2gEnabled, priceThreshold, simulationSpeed])

  // Auto-refresh simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setHourlyData(generateHourlyData())
    }, 15000 / simulationSpeed)
    return () => clearInterval(interval)
  }, [simulationSpeed, chargerType, batteryCapacity, earliestStart, latestEnd, v2gEnabled, priceThreshold])

  // Enhanced optimal charging calculation
  const calculateOptimalSchedule = useMemo(() => {
    const startHour = parseInt(earliestStart.split(':')[0])
    const endHour = parseInt(latestEnd.split(':')[0])
    const chargerPower = chargerSpecs[chargerType].power
    const efficiency = chargerSpecs[chargerType].efficiency

    const energyNeeded = ((targetCharge - currentCharge) / 100) * batteryCapacity
    const chargingHoursRequired = Math.ceil(energyNeeded / (chargerPower * efficiency))

    if (chargingHoursRequired === 0) {
      return {
        startTime: 'Already at target',
        endTime: '-',
        duration: 0,
        totalCost: '0.00',
        avgRate: '0.000',
        energyAdded: '0.0',
        carbonSaved: 0,
        optimalHours: []
      }
    }

    // Find optimal hours considering price and carbon intensity
    const availableHours = hourlyData.filter(data =>
        data.hour >= startHour && data.hour <= Math.min(23, endHour - 1)
    )

    let bestStart = startHour
    let lowestScore = Infinity
    let bestHours = []

    for (let i = 0; i <= availableHours.length - chargingHoursRequired; i++) {
      const hours = availableHours.slice(i, i + chargingHoursRequired)
      const cost = hours.reduce((sum, hour) => sum + hour.price, 0)
      const carbon = hours.reduce((sum, hour) => sum + hour.carbonIntensity, 0)
      const renewableScore = hours.reduce((sum, hour) => sum + hour.renewable, 0)

      // Weighted score: 60% cost, 40% environmental impact
      const score = cost * 0.6 + (carbon / renewableScore) * 0.4

      if (score < lowestScore && i + chargingHoursRequired <= availableHours.length) {
        lowestScore = score
        bestStart = hours[0].hour
        bestHours = hours
      }
    }

    const totalCost = (bestHours.reduce((sum, hour) => sum + hour.price, 0) * chargerPower * efficiency).toFixed(2)
    const avgRate = (bestHours.reduce((sum, hour) => sum + hour.price, 0) / chargingHoursRequired).toFixed(3)
    const carbonSaved = bestHours.reduce((sum, hour) => sum + (400 - hour.carbonIntensity), 0)

    return {
      startTime: `${bestStart.toString().padStart(2, '0')}:00`,
      endTime: `${(bestStart + chargingHoursRequired).toString().padStart(2, '0')}:00`,
      duration: chargingHoursRequired,
      totalCost,
      avgRate,
      energyAdded: energyNeeded.toFixed(1),
      carbonSaved: carbonSaved.toFixed(0),
      optimalHours: bestHours
    }
  }, [hourlyData, chargerType, batteryCapacity, currentCharge, targetCharge, earliestStart, latestEnd])

  // Enhanced V2G opportunities
  const v2gOpportunities = useMemo(() => {
    if (!v2gEnabled) return []

    return hourlyData
        .filter(data => data.price > priceThreshold)
        .sort((a, b) => b.v2gRate - a.v2gRate)
        .slice(0, 6)
        .map(data => ({
          time: data.time,
          sellRate: data.v2gRate,
          buyRate: data.price,
          profit: (data.v2gRate - data.price).toFixed(3),
          potential: ((batteryCapacity * Math.min(currentCharge - 20, 60) / 100) * (data.v2gRate - data.price)).toFixed(2),
          duration: '1h'
        }))
  }, [hourlyData, priceThreshold, v2gEnabled, batteryCapacity, currentCharge])

  // Color theme based on current charge level
  const getChargeColor = (percentage) => {
    if (percentage < 20) return 'from-red-500 to-red-600'
    if (percentage < 50) return 'from-yellow-400 to-orange-500'
    if (percentage < 80) return 'from-blue-400 to-blue-600'
    return 'from-green-400 to-green-600'
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-2 sm:p-4">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Enhanced Header with Real-time Status */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="animate-pulse mr-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ⚡ Smart EV Charging Hub
              </h1>
            </div>
            <p className="text-gray-600 text-sm sm:text-base">AI-Powered Charging Optimization • Live Grid Integration • Carbon Neutral Focus</p>
            <div className="flex justify-center mt-2 space-x-4 text-xs sm:text-sm">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">🌱 Renewable Focus</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">💡 Cost Optimized</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">🔄 V2G Ready</span>
            </div>
          </div>

          {/* Enhanced Control Panel */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 border border-white/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-0">🎛️ Control Center</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Simulation Speed:</span>
                <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={simulationSpeed}
                    onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                    className="w-20"
                />
                <span className="text-sm font-semibold text-blue-600">{simulationSpeed}x</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Charger Type with Visual Feedback */}
              <div className={`p-4 rounded-xl ${chargerSpecs[chargerType].bgColor} border-2 border-transparent hover:border-blue-300 transition-all`}>
                <label className="block text-sm font-semibold text-black mb-2">⚡ Charger Type</label>
                <select
                    value={chargerType}
                    onChange={(e) => setChargerType(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white/80 text-black"
                >
                  {Object.keys(chargerSpecs).map(type => (
                      <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-black">
                  <div>Power: {chargerSpecs[chargerType].power} kW</div>
                  <div>Efficiency: {(chargerSpecs[chargerType].efficiency * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Battery Capacity */}
              <div className="p-4 rounded-xl bg-indigo-50 border-2 border-transparent hover:border-indigo-300 transition-all">
                <label className="block text-sm font-semibold text-gray-700 mb-2">🔋 Battery (kWh)</label>
                <input
                    type="number"
                    value={batteryCapacity}
                    onChange={(e) => setBatteryCapacity(Number(e.target.value))}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white/80 text-black"
                    min="20"
                    max="200"
                    step="5"
                />
                <div className="text-xs text-gray-600 mt-2">
                  Range: ~{(batteryCapacity * 3.5).toFixed(0)} miles
                </div>
              </div>

              {/* Current Charge with Visual Battery */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-transparent hover:border-yellow-300 transition-all">
                <label className="block text-sm font-semibold text-gray-700 mb-2">📊 Current Charge</label>
                <input
                    type="range"
                    value={currentCharge}
                    onChange={(e) => setCurrentCharge(Number(e.target.value))}
                    className="w-full mb-2"
                    min="10"
                    max="100"
                />
                <div className="text-center">
                  <div className={`text-2xl font-bold bg-gradient-to-r ${getChargeColor(currentCharge)} bg-clip-text text-transparent`}>
                    {currentCharge}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                        className={`bg-gradient-to-r ${getChargeColor(currentCharge)} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${currentCharge}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Target Charge */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-transparent hover:border-green-300 transition-all">
                <label className="block text-sm font-semibold text-gray-700 mb-2">🎯 Target Charge</label>
                <input
                    type="range"
                    value={targetCharge}
                    onChange={(e) => setTargetCharge(Number(e.target.value))}
                    className="w-full mb-2"
                    min="20"
                    max="100"
                />
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{targetCharge}%</div>
                  <div className="text-xs text-gray-600">
                    +{((targetCharge - currentCharge) * batteryCapacity / 100).toFixed(1)} kWh
                  </div>
                </div>
              </div>

              {/* Time Constraints */}
              <div className="sm:col-span-2 lg:col-span-1 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-transparent hover:border-purple-300 transition-all">
                <label className="block text-sm font-semibold text-gray-700 mb-2">⏰ Time Window</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600">Start After</label>
                    <input
                        type="time"
                        value={earliestStart}
                        onChange={(e) => setEarliestStart(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white/80 text-black"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Finish By</label>
                    <input
                        type="time"
                        value={latestEnd}
                        onChange={(e) => setLatestEnd(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white/80 text-black"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* V2G Controls */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center">
                  <input
                      type="checkbox"
                      checked={v2gEnabled}
                      onChange={(e) => setV2gEnabled(e.target.checked)}
                      className="w-5 h-5 mr-3 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-800">🏦 Vehicle-to-Grid (V2G)</span>
                    <p className="text-xs text-gray-600">Sell energy back to grid during peak prices</p>
                  </div>
                </div>
                {v2gEnabled && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Min Price:</span>
                      <input
                          type="range"
                          min="0.15"
                          max="0.50"
                          step="0.01"
                          value={priceThreshold}
                          onChange={(e) => setPriceThreshold(Number(e.target.value))}
                          className="w-20"
                      />
                      <span className="text-sm font-semibold text-cyan-600">${priceThreshold}</span>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Optimal Charging Recommendation */}
          <div className={`bg-gradient-to-r ${getChargeColor(targetCharge)} text-white rounded-2xl shadow-xl p-4 sm:p-6 transform hover:scale-[1.02] transition-transform`}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center">
              🎯 Smart Charging Recommendation
              {calculateOptimalSchedule.duration > 0 && (
                  <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-sm animate-pulse">OPTIMAL</span>
              )}
            </h2>

            {calculateOptimalSchedule.duration > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                    <h3 className="font-semibold mb-2">⏰ Optimal Window</h3>
                    <p className="text-xl sm:text-2xl font-bold">{calculateOptimalSchedule.startTime}</p>
                    <p className="text-sm opacity-90">to {calculateOptimalSchedule.endTime}</p>
                    <p className="text-xs mt-1">Duration: {calculateOptimalSchedule.duration}h</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                    <h3 className="font-semibold mb-2">💰 Total Cost</h3>
                    <p className="text-xl sm:text-2xl font-bold">${calculateOptimalSchedule.totalCost}</p>
                    <p className="text-sm opacity-90">Avg: ${calculateOptimalSchedule.avgRate}/kWh</p>
                    <p className="text-xs mt-1">vs ${(calculateOptimalSchedule.totalCost * 1.3).toFixed(2)} peak</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                    <h3 className="font-semibold mb-2">⚡ Energy Added</h3>
                    <p className="text-xl sm:text-2xl font-bold">{calculateOptimalSchedule.energyAdded}</p>
                    <p className="text-sm opacity-90">kWh via {chargerType}</p>
                    <p className="text-xs mt-1">~{(calculateOptimalSchedule.energyAdded * 3.5).toFixed(0)} miles</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                    <h3 className="font-semibold mb-2">🌱 Carbon Impact</h3>
                    <p className="text-xl sm:text-2xl font-bold">{calculateOptimalSchedule.carbonSaved}</p>
                    <p className="text-sm opacity-90">lbs CO₂ saved</p>
                    <p className="text-xs mt-1">vs standard charging</p>
                  </div>
                </div>
            ) : (
                <div className="text-center py-8">
                  <p className="text-2xl font-bold mb-2">🎉 Already at Target!</p>
                  <p className="opacity-90">Your battery is at the desired charge level</p>
                </div>
            )}
          </div>

          {/* Responsive Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Dynamic Pricing Chart */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 hover:shadow-2xl transition-shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">📊 Dynamic Electricity Pricing</h3>
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis
                      dataKey="time"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                      yAxisId="price"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                      yAxisId="demand"
                      orientation="right"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip
                      contentStyle={{
                        backgroundColor: '#f8fafc',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [
                        name.includes('Price') || name.includes('V2G') ? `$${value}` : `${value}%`,
                        name
                      ]}
                  />
                  <Legend />
                  <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      name="Electricity Price ($/kWh)"
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                  <Area
                      yAxisId="demand"
                      type="monotone"
                      dataKey="demand"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.1}
                      name="Grid Demand (%)"
                  />
                  {v2gEnabled && (
                      <Line
                          yAxisId="price"
                          type="monotone"
                          dataKey="v2gRate"
                          stroke="#059669"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          name="V2G Rate ($/kWh)"
                          dot={{ fill: '#059669', strokeWidth: 2, r: 3 }}
                      />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Grid Analytics */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 hover:shadow-2xl transition-shadow">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">⚡ Grid Load & Renewables</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis
                      dataKey="time"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip
                      contentStyle={{
                        backgroundColor: '#f8fafc',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                  />
                  <Legend />
                  <Area
                      type="monotone"
                      dataKey="gridLoad"
                      stackId="1"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.8}
                      name="Grid Load %"
                  />
                  <Area
                      type="monotone"
                      dataKey="renewable"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Renewable Mix %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Carbon Intensity Chart */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 hover:shadow-2xl transition-shadow">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">🌍 Carbon Intensity</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis
                      dataKey="time"
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                      fontSize={12}
                      tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip
                      contentStyle={{
                        backgroundColor: '#f8fafc',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [`${value} lbs CO₂/MWh`, 'Carbon Intensity']}
                  />
                  <Bar
                      dataKey="carbonIntensity"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      name="Carbon Intensity"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Enhanced Battery Visualization */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 hover:shadow-2xl transition-shadow">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">🔋 Battery Analytics</h3>
              <div className="space-y-6">

                {/* Battery Visual */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">Current Status</span>
                    <span className={`text-2xl font-bold bg-gradient-to-r ${getChargeColor(currentCharge)} bg-clip-text text-transparent`}>
                    {currentCharge}%
                  </span>
                  </div>

                  <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <div
                        className={`h-full bg-gradient-to-r ${getChargeColor(currentCharge)} transition-all duration-1000 ease-out relative`}
                        style={{ width: `${currentCharge}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                    {/* Target marker */}
                    <div
                        className="absolute top-0 h-8 w-1 bg-green-600 shadow-lg"
                        style={{ left: `${targetCharge}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span className="font-semibold text-green-600">Target: {targetCharge}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Battery Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <p className="text-xs text-gray-600">Capacity</p>
                    <p className="text-xl font-bold text-blue-600">{batteryCapacity}</p>
                    <p className="text-xs text-gray-500">kWh</p>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                    <p className="text-xs text-gray-600">Range</p>
                    <p className="text-xl font-bold text-green-600">{(currentCharge * batteryCapacity * 3.5 / 100).toFixed(0)}</p>
                    <p className="text-xs text-gray-500">miles</p>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl">
                    <p className="text-xs text-gray-600">Energy Needed</p>
                    <p className="text-xl font-bold text-orange-600">{((targetCharge - currentCharge) * batteryCapacity / 100).toFixed(1)}</p>
                    <p className="text-xs text-gray-500">kWh</p>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                    <p className="text-xs text-gray-600">Charge Time</p>
                    <p className="text-xl font-bold text-purple-600">{calculateOptimalSchedule.duration}</p>
                    <p className="text-xs text-gray-500">hours</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced V2G Opportunities */}
          {v2gEnabled && v2gOpportunities.length > 0 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center">
                  🏦 Vehicle-to-Grid Opportunities
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {v2gOpportunities.length} Available
              </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {v2gOpportunities.map((opp, index) => (
                      <div key={index} className="border-2 border-gray-100 rounded-xl p-4 hover:shadow-lg hover:border-green-200 transition-all bg-gradient-to-br from-green-50 to-emerald-50">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-bold text-lg text-green-700">{opp.time}</h4>
                          <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-semibold">
                      #{index + 1}
                    </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sell Rate:</span>
                            <span className="font-semibold text-green-600">${opp.sellRate}/kWh</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Buy Rate:</span>
                            <span className="font-semibold text-red-600">${opp.buyRate}/kWh</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Profit/kWh:</span>
                            <span className="font-bold text-green-500">${opp.profit}</span>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 font-medium">Potential:</span>
                              <span className="font-bold text-lg text-green-600">${opp.potential}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
          )}

          {/* Enhanced Real-time Dashboard */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">📈 Live Grid Dashboard</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2 sm:mt-0">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Updates every {Math.round(15 / simulationSpeed)}s</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:scale-105 transition-transform">
                <h4 className="text-sm font-medium text-gray-600 mb-1">Current Price</h4>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  ${hourlyData[new Date().getHours()]?.price.toFixed(3)}
                </p>
                <p className="text-xs text-gray-500">/kWh</p>
                <div className="mt-2 text-xs">
                  {hourlyData[new Date().getHours()]?.price < 0.15 ? (
                      <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full">💚 Low</span>
                  ) : hourlyData[new Date().getHours()]?.price > 0.25 ? (
                      <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full">🔴 High</span>
                  ) : (
                      <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full">🟡 Medium</span>
                  )}
                </div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover:scale-105 transition-transform">
                <h4 className="text-sm font-medium text-gray-600 mb-1">Grid Load</h4>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">
                  {hourlyData[new Date().getHours()]?.gridLoad.toFixed(0)}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${hourlyData[new Date().getHours()]?.gridLoad}%` }}
                  ></div>
                </div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl hover:scale-105 transition-transform">
                <h4 className="text-sm font-medium text-gray-600 mb-1">Renewable Mix</h4>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600">
                  {hourlyData[new Date().getHours()]?.renewable.toFixed(0)}%
                </p>
                <div className="mt-2 text-xs">
                  🌱 {hourlyData[new Date().getHours()]?.renewable > 70 ? 'Excellent' :
                    hourlyData[new Date().getHours()]?.renewable > 50 ? 'Good' : 'Limited'}
                </div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:scale-105 transition-transform">
                <h4 className="text-sm font-medium text-gray-600 mb-1">
                  {v2gEnabled ? 'V2G Rate' : 'Carbon Intensity'}
                </h4>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                  {v2gEnabled
                      ? `$${hourlyData[new Date().getHours()]?.v2gRate.toFixed(3)}`
                      : `${hourlyData[new Date().getHours()]?.carbonIntensity}`
                  }
                </p>
                <p className="text-xs text-gray-500">
                  {v2gEnabled ? '/kWh' : 'lbs CO₂/MWh'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-500 text-sm">
            <div className="flex justify-center items-center space-x-4 mb-2">
              <span>🔄 Auto-refresh: {simulationSpeed}x speed</span>
              <span>•</span>
              <span>📊 Last updated: {new Date().toLocaleTimeString()}</span>
              <span>•</span>
              <span>⚡ {chargerType} Active</span>
            </div>
            <p className="text-xs">Smart EV Charging Hub • AI-Powered Grid Integration • Real-time Price Optimization</p>
          </div>

        </div>
      </div>
  )
}

export default SmartChargingDashboard
