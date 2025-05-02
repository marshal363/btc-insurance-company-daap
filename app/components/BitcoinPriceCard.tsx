const PriceChangeIndicator = ({ changePercentage }: { changePercentage: number }) => {
  // Determine color based on price movement
  const color = changePercentage > 0 ? 'text-green-500' : 
                changePercentage < 0 ? 'text-red-500' : 
                'text-neutral-500';
  
  // Determine icon based on direction
  const icon = changePercentage > 0 ? '↑' : 
               changePercentage < 0 ? '↓' : 
               '→';
               
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full bg-opacity-10 ${
      changePercentage > 0 ? 'bg-green-100' : 
      changePercentage < 0 ? 'bg-red-100' : 
      'bg-neutral-100'
    }`}>
      <span className={`text-lg font-medium ${color}`}>{icon} {Math.abs(changePercentage).toFixed(2)}%</span>
    </div>
  );
};

<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
  <div className="flex items-center gap-2 mb-4">
    <TrendingUpIcon className="h-5 w-5 text-blue-500" />
    <h3 className="text-xl font-medium text-gray-700">Current Price</h3>
  </div>
  
  <div className="mt-4">
    <h2 className="text-4xl font-bold text-gray-900">{priceData ? formatCurrency(priceData.price) : "$---.--"}</h2>
    
    {priceData && (
      <div className="mt-3">
        <PriceChangeIndicator changePercentage={changePercentage24h || 0} />
        <p className="mt-2 text-sm text-gray-500">Change in the last 24 hours</p>
      </div>
    )}
    
    {!priceData && <p className="mt-2 text-sm text-gray-500">Loading latest price...</p>}
  </div>
  
  <div className="mt-6">
    <button 
      onClick={toggleSourcesVisible}
      className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors text-sm font-medium"
    >
      {isSourcesVisible ? 'Hide Sources' : 'View Sources'} 
      <ChevronDownIcon className={`h-4 w-4 transition-transform ${isSourcesVisible ? 'rotate-180' : ''}`} />
    </button>
  </div>
</div> 