//Import chart.js
import Chart from 'chart.js/auto';

(function() { // (Immediately invoked function execution, IIFE) Being anonymous function, it avoids polluting the global scope.
    //The function can be invoked only once since it has no name, but this function is meant to be executed only once anyway.

    //Price chart setup
    const labels = [];
    const priceData = {
        labels: labels,
        datasets: [{
            label: 'Bitcoin value in €',
            backgroundColor: 'rgb(255, 99, 132)',
            borderColor: 'rgb(255, 99, 132)',
            priceData: [],
        }]
    };
    //Price chart config
    const config = {
        type: 'line',
        data: priceData,
        options: {}
    };
    //Price chart rendering
    const PriceChart = new Chart(
        document.getElementById('ChartCanvas'),
        config
    );

    //Volume chart setup
    const volumeData = {
        labels: labels,
        datasets: [{
            label: 'Bitcoin trade volume in €',
            backgroundColor: 'rgb(0, 0, 255)',
            borderColor: 'rgb(0, 0, 255)',
            data: [],
        }]
    };
    //Volume chart config
    const configVolume = {
        type: 'line',
        data: volumeData,
        options: {}
    };
    //Volume Chart rendering
    const VolumeChart = new Chart(
        document.getElementById('VolumeChartCanvas'),
        configVolume
    );

    // Formatter for Euro values to make reading them easier.
    let formatter = new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR',});
    // Constants
    const s_per_day = 86400; // Seconds in a day
    const s_per_hour = 3600 // Seconds in an hour
    const elementErrorMessage = document.getElementById("error_ele");
    const elementBearishTrend = document.getElementById("bearish_ele");
    const elementTradingVolume = document.getElementById("volume_value_ele");
    const elementBuySellDays = document.getElementById("best_dates_ele");
    const elementBearishSummary = document.getElementById("bearish_summary");
    const elementTradingSummary = document.getElementById("volume_value_summary");
    const elementBuySellSummary = document.getElementById("best_dates_summary");
    const address = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=eur&from="
    // Time selection elements
    let startDateElement = document.getElementById('startdate');
    let endDateElement = document.getElementById('enddate');
    
    // Get the button element reference from html
    // First, add eventlistener for content being loaded, this guarantees that code has access to all DOM elements
    document.addEventListener("DOMContentLoaded", function(event) { 
        let button = document.getElementById("getDataButton");
        // Configure event handler. No () after the function name since it is not being invoked
        button.addEventListener("click", getData);
    });

    // get diff of two values to find closest time point to midnights
    let difference = function (a, b) { return Math.abs(a - b); }

    function getData() { //The actual function for getting data and presenting it, called when button is pressed
        let startDate = startDateElement.value;
        let endDate = endDateElement.value;
        if (startDate > endDate) {
            elementErrorMessage.innerHTML = "WARNING: Set the start date to be before the end date."
            console.log("WARNING: Set the start date to be before the end date.")
            return
        }
        else {
            elementErrorMessage.innerHTML = ""
        }
        startDate = new Date(startDate).getTime() / 1000 - s_per_day
        // get the last days data as well, which may go over to the next day by few minutes
        // 3600 (one hour), 86400 (24 hours), 90000 (25 hours)
        // Add time to the ranges end parameter to get the values at end point.
        endDate = new Date(endDate).getTime() / 1000 + s_per_hour
        let currentAddress = address.concat(startDate, "&to=", endDate);
        // Fetch the bitcoin data from the application programming interface
        fetch(currentAddress)
        .then(data => data.json())
        .then(data => parseData(data, startDate, endDate));
    }

    function resetValues() {
        // Reset price and volume data so we don't use the old data to fill the charts and get the information
        priceData.datasets[0]["data"] = []
        volumeData.datasets[0]["data"] = []
        // empty the labels array so we don't use the old data
        labels.length = 0
    }

    // Chart data setter
    function setChartData(closestTimePoints, dailyPrices, dailyVolumes, datesUTC) {
        for (let i = 0; i < closestTimePoints.length; i++) {
            // Push the UTC string format dates into the labels array that the two charts use
            labels.push(datesUTC[i])
            // Add prices and trading volumes to charts datasets
            priceData.datasets[0]["data"].push(dailyPrices[i])
            volumeData.datasets[0]["data"].push(dailyVolumes[i])
        }
    }

    // getter for which determines and returns all midnights within time selection
    function getMidnights(currentNight, endDate) {
        let keepGoing = true;
        let midnights = [];
        while (keepGoing == true) {
            if (currentNight < endDate) {
                midnights.push(currentNight * 1000) //multiply by 1000 due to ms being 1/1000 of second
                currentNight = currentNight + s_per_day
            }
            else {
                keepGoing = false
            }
        }
        return midnights
    }

    // Get timepoints
    function getDatesUTC(closestTimePoints) {
        var datesUTC = [] // Dates as UTC format string
        for (let i = 0; i < closestTimePoints.length; i++) {
            let newDate = new Date(closestTimePoints[i]);
            datesUTC.push(newDate.toUTCString())
        }
        return datesUTC
    }

    function parseData(receivedData, startDate, endDate) { //Use data received from the API
        resetValues() //reset the chart values to original state
        // prices is array of arrays which has first the time in unix time and then the actual value. Ex. [ 1637175613629, 53723.26420170224 ]
        let prices = receivedData["prices"];
        let volumes = receivedData["total_volumes"];
        let ms_until_midnight = s_per_day - startDate % s_per_day;
        // all midnights between start and end time. Not the actual available data points but the targets we want to get close to
        let currentNight = startDate + ms_until_midnight;
        let midnights = getMidnights(currentNight, endDate);

        //Gather time points, prices and trade values closest to every midnight during time selection
        let closestTimePoints = []; //timepoints closest to the midnigths that we want data from
        let dailyPrices = [];
        let dailyVolumes = [];
        for (let i = 0; i < midnights.length; i++) {
            let previousDiff = null;
            let currentDiff = null;
            let nextDiff = null;
            for (let u = 0; u < prices.length; u++) {
                // Use difference to find closest value to midnights
                if (u != 0 && closestTimePoints.length <= i) {
                    if(u + 1 >= prices.length) {
                        previousDiff = difference(midnights[i], prices[u-1][0])
                        currentDiff = difference(midnights[i], prices[u][0])
                        if (previousDiff < currentDiff){
                            closestTimePoints.push(prices[u-1][0])
                            dailyPrices.push(prices[u-1][1])
                            dailyVolumes.push(volumes[u-1][1])
                        }
                        else {
                            closestTimePoints.push(prices[u][0])
                            dailyPrices.push(prices[u][1])
                            dailyVolumes.push(volumes[u][1])
                        }
                    }
                    else {
                        previousDiff = difference(midnights[i], prices[u-1][0])
                        currentDiff = difference(midnights[i], prices[u][0])
                        nextDiff = difference(midnights[i], prices[u+1][0])
                        if (previousDiff > currentDiff && currentDiff < nextDiff){
                            closestTimePoints.push(prices[u][0])
                            dailyPrices.push(prices[u][1])
                            dailyVolumes.push(volumes[u][1])
                        }
                    }
                }
            }
        }

        // Get the midnights as UTC dates in string format
        let datesUTC = getDatesUTC(closestTimePoints);

        // Get longest bearish trend in days and the start and end date of the trend
        let insight1Array = getInsight1(dailyPrices, datesUTC);

        // Get day with highest trading volume in euros
        let insight2Array = getInsight2(dailyVolumes, datesUTC);
        
        // Get theoretical best days to buy and sell Bitcoin during selected time period by getting and comparing value increase multipliers
        let insight3Array = getInsight3(dailyPrices, closestTimePoints);

        // update text elements with points of interest in the data
        updateInsights(insight1Array, insight2Array, insight3Array)

        // Set relevant data to charts labels and datasets
        setChartData(closestTimePoints, dailyPrices, dailyVolumes, datesUTC)
        
        // update charts with price and trade volume information
        updateCharts()
    }

    function getInsight1(dailyPrices, datesUTC) {
        // Get longest bearish trend in days and the start and end date of the trend in UTC
        let previousPrice = 0;
        let trendLength = 0;
        let trendLengthMax = 0;
        let trendIndex = 0;
        for (let i = 0; i < dailyPrices.length; i++) {
            if (previousPrice != 0) {
                if (previousPrice > dailyPrices[i]) {
                    trendLength++;
                    if (trendLength > trendLengthMax) {
                        trendLengthMax = trendLength
                        trendIndex = i
                    }
                }
                else {
                    trendLength = 0
                }
            }
            previousPrice = dailyPrices[i]
        }
        return [trendLengthMax, datesUTC[trendIndex - trendLengthMax], datesUTC[trendIndex]]
    }

    function getInsight2(dailyVolumes, datesUTC) { //Date of highest trade volume and the trade volume in euros
        let highestTradingDay = null;
        let highestTradingVolume = 0;
        for (let i = 0; i < dailyVolumes.length; i++) {
            if (dailyVolumes[i] > highestTradingVolume) {
                highestTradingVolume = dailyVolumes[i]
                highestTradingDay = datesUTC[i]
            }
        }
        return [highestTradingDay, formatter.format(highestTradingVolume)]
    }

    function getInsight3(dailyPrices, closestTimePoints) { // Best days to buy and sell bitcoin
        let highestMultiplier = 0.0;
        let startEndDate = []; //array containing two values, the best days for buying and selling
        for (let i = 0; i < dailyPrices.length; i++) {
            for (let x = i + 1; x < dailyPrices.length; x++) {
                if (dailyPrices[x] / dailyPrices[i] > highestMultiplier) {
                    highestMultiplier = dailyPrices[x] / dailyPrices[i]
                    startEndDate = [i, x]
                }
            }
        }
        highestMultiplier = highestMultiplier.toPrecision(6);
        let buyDay, SellDay, buyDate, SellDate;
        let newDate = new Date(closestTimePoints[startEndDate[0]]);
        buyDay = newDate.toUTCString()
        buyDate = newDate.toDateString()
        newDate = new Date(closestTimePoints[startEndDate[1]]);
        SellDay = newDate.toUTCString()
        SellDate = newDate.toDateString()
        return [buyDay, SellDay, highestMultiplier, buyDate, SellDate]
    }

    function updateCharts() {
        PriceChart.update();
        VolumeChart.update();
    }

    function updateInsights(insight1Array, insight2Array, insight3Array) {
        // Set longest bearish trend to the element 1
        elementBearishTrend.innerHTML = "Longest bearish, AKA downwards trend in days during the selected time period is " + insight1Array[0] + " days, starting from " + insight1Array[1] + " and ending on " + insight1Array[2];
        elementBearishSummary.innerHTML = insight1Array[0] + " days";
        // Set day with highest trading volume to element 2
        elementTradingVolume.innerHTML = "Highest trading volume in Euros during the selected time period was on " + insight2Array[0] + " with value of " + insight2Array[1];
        elementTradingSummary.innerHTML = insight2Array[1];
        // Set best days to buy and sell Bitcoin to element 3
        if (insight3Array[2] <= 1.0) {
            elementBuySellDays.innerHTML = "Bitcoin's price did not increase during selected time period.";
            elementBuySellSummary.innerHTML = "None";
        }
        else {
            elementBuySellDays.innerHTML = "Best days to buy and sell during the selected time period was to buy on " + insight3Array[0] + " and sell on " + insight3Array[1] + " with price being multiplied by " + insight3Array[2];
            elementBuySellSummary.innerHTML = insight3Array[3] + " and " + insight3Array[4];
        }
    }

}) ();