define(function (require) {
    var d3 = require('d3');
    require('../../src/bootstrap-multiselect/js/bootstrap-multiselect');
    require('multiselect');
    
    /////////////////////////////
    //initiate settings object //
    /////////////////////////////
    var settings = {} //settings object to be updated on UI Changes
    settings.standardizeOutcome = true;
    settings.nshown = {aes:5, drug:5, generic:5, manufacturer:5}
    settings.results=[
            {label:"gender", text:"Gender", display:true},
            {label:"age", text:"Age", display:true},
            {label:"aes", text:"Adverse Events", display:true},
            {label:"drug", text:"Drug", display:false},
            {label:"generic",text:"Generic", display:false},
            {label:"manufacturer",text:"Manufacturer", display:false},
            {label:"dates", text:"Report Date", display:true}
        ]
    settings.filters=[];
    settings.filterText="";
    settings.comparisonVars =  [
        {label:"Drug",openfda_var:"patient.drug.medicinalproduct", active:true, options:[]},
        {label:"Generic",openfda_var:"patient.drug.openfda.generic_name",active:false,options:[]},
        {label:"Manufacturer",openfda_var:"patient.drug.openfda.manufacturer_name",active:false,options:[]},
        {label:"PreferredTerm",openfda_var:"patient.reaction.reactionmeddrapt",active:false,options:[]}     
    ]

    settings.filters = [
      {label:"Reaction Outcome",openfda_var:"patient.drug.drugcharacterization",filterText:"",options:[
        {key:-1,value:"Show All"},
        {key:1,value:"Suspect drug"},
        {key:2,value:"Concomitant drug"},
        {key:3,value:"Interacting drug"},
        {key:0,value:"Missing"}
        ]
      },
      {label:"Drug Role",openfda_var:"patient.reaction.reactionoutcome", filterText:"",options:[
        {key:-1,value:"Show All"},
        {key:1,value:"Recovered/resolved"},
        {key:2,value:"Recovering/resolving"},
        {key:3,value:"Not recovered/not resolved"},
        {key:4,value:"Recovered/resolved with sequelae"},
        {key:5,value:"Fatal"},
        {key:6,value:"Unknown"},
        {key:0,value:"Missing"}
      ]
     }
    ]

    ////////////// Formats and scales //////////////////
    var percent = d3.format(".1%")

    var genderScale = d3.scale.ordinal()
    .domain([0,1,2])
    .range(["Unknown","Male","Female"])
    var percent = d3.format(".1%")

    ageDomain = ["[0+TO+17.999999]","[18+TO+34.999999]","[35+TO+44.9999999]","[45+TO+59.999999]","[60+TO+120]"]
    var ageScale = d3.scale.ordinal()
    .domain(ageDomain)
    .range(["0 to 18","18 to 35","35 to 45","45 to 60","60+"])
    


    ///////////// Function to create API calls ////////////////
    function getQueryText(groupVar, groupName, subsets, queryObj){
        //returns the url for a query (or queries) to the openFDA API
        var baseURL = "https://api.fda.gov/drug/event.json?api_key=qAFTdMe7f2rBKCejuDvwWpBNASKymQ20pC3Mi1rT&"
        
        var search1 = groupVar+'.exact:"'+groupName.replace(/[\s]/gi,'+').replace(/[,']/gi,'')+'"' // Basic search for Drug/Company
        var search2 = subsets==undefined?null:subsets //Filter by severity, etc
        var search3 =  queryObj.type=="ranges"?queryObj.ranges:null//get count within a given range
        var searchText = search1
        searchText = search2 ? searchText + "+AND+" + search2 : searchText
        if(search3==null){
            searchText = [searchText]
        } else {
            searchText = search3.map(function(e){
                return searchText + "+AND+" + queryObj.resultVar+":"+e
            })
        } 

        var multiSearch = search2 || search3 //only 1 search parameter? 
        searchText = searchText.map(function(d){
            return "search=(receivedate:[20040101+TO+20150101]+AND+"+d+")"
        })
        var countText  = queryObj.type=="raw"?"&count="+queryObj.resultVar+"&limit=100":""
        var queryText = searchText.map(function(d){
            return baseURL+d+countText
        })
        return queryText
    }

    //console.log(queryText("patient.drug.medicinalproduct","ENBREL","patientsex:1",settings.queries[2]))

    function smartCap(str){
        var lstr = str.toLowerCase();
        var arr = lstr.split(" ");
        var carr = arr.map(function(e){return e.charAt(0).toUpperCase()+e.slice(1); });
        var cap_str = carr.join(" ");
        return cap_str;
    }

    //////////////
    // controls //
    //////////////
    //controls - Choose outcome
    var controls = d3.select("div.controls").append("div.row1")
    var comp_control = controls.append("div").attr("class", "control-group")
    comp_control.append("span").attr("class", "control-label").text("Pick Comparison Variable")
    var comparisonToggle = comp_control.append("div")
        .attr("class","btn-group btn-group-sm comparisonToggle")
        .selectAll("button")
        .data(settings.comparisonVars,function(d){return d.label})
        .enter()
        .append("button")
        .attr("class","btn btn-default")
        .text(function(d){return d.label=="PreferredTerm"?"Preferred Term":d.label})
        .classed("btn-primary",function(d,i){return d.active})
        .on("click",function(d,i){
            d3.select("div.viz.barchart").insert("i", ":first-child").attr("class", "fa fa-circle-o-notch fa-spin fa-4x")
            var result_section = d3.select("div.results").classed("hidden",true)

            //toggle buttons & hide/show select
            d3.select(".comparisonToggle").selectAll("button").classed("btn-primary",false);
            d3.select(this).classed("btn-primary",true);
            d3.selectAll("div.groupSelect").classed("hidden",true)
            d3.select("div.groupSelect."+d.label).classed("hidden",false)

            //update settings object;
            settings.comparisonVars.forEach(function(e){e.active=false;})
            d.active=true;  

            d3.select("div.results .header-row .header-col").text(d.label=="PreferredTerm"?"Preferred Term":d.label)

            drawCharts(settings) //update the chart
        })

        //Controls - Create dynamic selectors for each possible comparison variable - runs once on load. 
        .each(function(d,i){
            var currentDiv = controls.append("div")
            .attr("class","control-group groupSelect "+d.label)
            .classed("hidden",i>0)
            
            currentDiv.append("span")
            .attr("class", "control-label")
            .text("Select "+d.label+"s to compare ")
            .append("span")
            .attr("class","label label-warning manufacturerWarning")
            .classed("hidden",d.label!=="Manufacturer")
            .text("Manufacturers with special characters (e.g. commas) may not appear.")
            
            var currentSelect = currentDiv.append("select")
            .attr("class","multiselect "+d.label)
            .attr("multiple","multiple")
            
            $.getJSON("https://api.fda.gov/drug/event.json?search=receivedate:[20040101+TO+20150101]&count="+d.openfda_var+".exact&limit=1000", 
                function(response){ 
                    response.results.forEach(function(e){
                        e.total=e.count
                        e.queries=[
                            {label:"aes", type:"raw", resultVar:"patient.reaction.reactionmeddrapt.exact", labels: null, missingAdj:false, search:true},
                            {label:"drug", type:"raw", resultVar:"patient.drug.medicinalproduct.exact", labels:null, missingAdj:false, search:true},
                            {label:"generic",type:"raw", resultVar:"patient.drug.openfda.generic_name.exact",labels:null, missingAdj:false, search:true},
                            {label:"manufacturer",type:"raw", resultVar:"patient.drug.openfda.manufacturer_name.exact",labels:null, missingAdj:false, search:true},
                            {label:"gender", type:"raw", resultVar:"patientsex", labels: genderScale, missingAdj:true, search:false},
                            {label:"age", type:"ranges",resultVar:"patientonsetage", ranges:ageDomain, labels:ageScale, missingAdj:true, search:false},
                            {label:"dates", type:"raw", resultVar:"receivedate", labels: null, missingAdj:false, search:false}
                        ]

                        e.queries.forEach(function(q){
                            q.queryText = getQueryText(d.openfda_var,e.term,null,q)
                            q.results = null
                        })
                    }) //save the total for later (so that we have it when we filter)
                    d.options = response.results; //store the response  to the settings object; 
                    
                    //initialize the settings
                    var initialGroups = [0,1,2]
                    initialGroups.forEach(function(n){
                        d.options[n].active=true;
                    })
                    
                    // console.log(settings)
                    if(i==0){drawCharts(settings)} //draw initial plot          
                   
                    //fill in the values in the select
                    currentSelect.selectAll("option")
                    .data(d.options, function(d){return d.term})
                    .enter()
                    .append("option")
                    .text(function(d){return d.term + " ("+d.count+")"})
                    .each(function(d){if(d.active){d3.select(this).attr("selected","selected")}});

                    $('.multiselect.'+d.label).multiselect({
                        enableCaseInsensitiveFiltering:true,  
                        onChange: function(option, checked) {
                            //$(option).attr("selected", checked?"selected":"bobo")
                            d3.select(option[0]).attr("selected",checked?"selected":null)
                            var currentLevels = d3.select('select.multiselect.'+d.label).selectAll('option')

                            currentLevels
                            .data()
                            .forEach(function(e){
                                e.active=false;
                                e.test=1
                            })

                            currentLevels
                            .filter(function(){return d3.select(this).attr("selected")=="selected"})
                            .data() 
                            .forEach(function(e){
                                // console.log(e)
                                e.active=true
                            })       

                            drawCharts(settings)
                        }
                    });
                }
            );
        });

        //Select which rows to show
        var controls2 = d3.select("div.controls").append("div.row2")

        var toggle_control = controls2.append("div").attr("class", "control-group").style("display","block")
        toggle_control.append("span").attr("class", "control-label").text("Show/Hide Results ")
        .append("small").append("a").text("Show All").on("click",function(){
            settings.results.forEach(function(d){d.display = true})
            d3.selectAll(".results-row").classed("hidden",false)
            d3.select(".resultToggle").selectAll("button").classed("btn-primary",true)
        })
        var resultToggle = toggle_control.append("div")
            .attr("class","btn-group btn-group-sm resultToggle")
            .selectAll("button")
            .data(settings.results)
            .enter()
            .append("button")
            .attr("class","btn btn-default")
            .text(function(d){return d.text})
            .classed("btn-primary",function(d){return d.display})
            .on("click",function(d,i){
                if(d3.event.ctrlKey){
                    d3.select(".resultToggle").selectAll("button").classed("btn-primary",false)
                    .each(function(e){
                        e.display=false
                    })
                    d3.select(this).classed("btn-primary",true)
                    d.display=T
                    d3.selectAll(".results-row").classed("hidden",!d.display)               
                }else{
                    var toggle = d3.select(this).classed("btn-primary")
                    d3.select(this).classed("btn-primary",!toggle)
                    d.display = !d.display
                    d3.select(".results-row."+d.label+"-row").classed("hidden",!d.display)
                }
            })

    //////////////////////////////////
    /// Layout the comparison Table //
    //////////////////////////////////
    // Functions to create controls for individual queries
    function resetBars(type){
        var resultRow = d3.select(".results-row."+type+"-row")
        resultRow.selectAll(".query-result").each(function(e){
            var matchedBars = d3.select(this).selectAll("li.bars").filter(function(f,i){return i+1 > settings.nshown[type]})
            matchedBars.classed("hidden", true);
        });                 
        resultRow.selectAll("li.bars").select("rect").attr({"fill":"#bbb"})
        resultRow.selectAll("li.bars").select("text.value").classed("hidden",true);
        resultRow.selectAll("li.bars").select("text.term").attr("fill","black")

        resultRow.selectAll(".extra.bars").classed("hidden", true);
    }

    function initQueryControls(type, label){
        var resultRow= d3.select("div.results-row."+type+"-row")
        var Controls = resultRow.select(".header-col").append("div").attr("class","ig-controls")
        var result_tweak = Controls.append("div").attr("class", "control-group").style("display","block");
        result_tweak.append("span").attr("class", "control-label").html("Top <span class='numShown'>"+settings.nshown[type]+"</span> "+label).style("font-size","1em")
        var five_btns = result_tweak.append("div").attr("class", "btn-group  btn-group-xs");
        five_btns.append("button").attr("class","btn btn-default add5").text("Add 5 ")
        .classed("disabled",settings.nshown[type]==100)
        .on("click",function(){
            if(settings.nshown[type]<100){
                // console.log("adding 5 " + type)
                settings.nshown[type] = settings.nshown[type] + 5;
                resultRow.select("span.numShown").text(settings.nshown[type])
                resultRow.selectAll(".query-result").select("ul")
                    .selectAll("li").classed("hidden",function(d,i){return i+1>settings.nshown[type]});
                if(settings.nshown[type] > 5)       
                    resultRow.select(".rem5").classed("disabled", false);
                if(settings.nshown[type]===100)
                    d3.select(this).classed("disabled", true);
            }   
        })
        five_btns.append("button").attr("class","btn btn-default rem5").text("Remove 5")
        .classed("disabled",settings.nshown[type]==5)
        .on("click",function(){
            if (settings.nshown[type] >5){
                settings.nshown[type]  = settings.nshown[type]  - 5;
                resultRow.select("span.numShown").text(settings.nshown[type])
                resultRow.selectAll(".query-result").select("ul")
                    .selectAll("li").classed("hidden",function(d,i){return i+1>settings.nshown[type] });
                if(settings.nshown[type]  === 5)        
                    d3.select(this).classed("disabled", true);
                if(settings.nshown[type] <100)
                    resultRow.select(".add5").classed("disabled", false);
            }
        })

        var search_div = Controls.append("div").attr("class", "control-group search-box");
        search_div.append("span").attr("class", "control-label").text("Search for Preferred Term");
        search_div.append("input").attr({"type": "search", "placeholder": "search"})
        .on("input", function(){
            var val = d3.select(this).property("value");
            resetBars(type);
            if(val){
                resultRow.classed("searching",true)
                val = val.toLowerCase();
                resultRow.selectAll(".query-result").each(function(e){
                    var matchedBars = d3.select(this).selectAll("li.bars").filter(function(f){return f.term.toLowerCase().indexOf(val) !== -1})
                    matchedBars.classed("hidden", false);
                    matchedBars.select("rect").attr({"fill":"lightBlue"})
                    matchedBars.select("text.value").classed("hidden",false);
                }); 
            }
            else{
                resultRow.classed("searching",false)
                resetBars(type);
            }
        })  
    }
    d3.select("div.viz.barchart").insert("i", ":first-child").attr("class", "fa fa-circle-o-notch fa-spin fa-4x")
    var result_section = d3.select("div.viz.barchart").append("div").attr("class","results hidden");

    //Initialize the summary layout //////////////////////////////////////////////////////////////
    //Headers/////////////////////////////////////////////////////////////////////////////////////
    var HeaderRow = result_section.append("div").attr("class","header-row results-row")
    HeaderRow.append("div").attr("class","header-col").text("Drug")

    //Counts//////////////////////////////////////////////////////////////////////////////////////
    var CountRow= result_section.append("div").attr("class","counts-row results-row")
    CountRow.append("div").attr("class","header-col").text("Count")

    //Demographics - Gender //////////////////////////////////////////////////////////////////////
    var GenderRow= result_section.append("div").attr("class","gender-row results-row")
    GenderRow.append("div").attr("class","header-col").text("Gender")

    //Demographics - Age //////////////////////////////////////////////////////////////////////
    var AgeRow= result_section.append("div").attr("class","age-row results-row")
    AgeRow.append("div").attr("class","header-col").text("Age")

    //Preferred Term /////////////////////////////////////////////////////////////////////////////
    var PTRow = result_section.append("div").attr("class","aes-row results-row")
    var PTHead=PTRow.append("div").attr("class","header-col")
    PTHead.append("div").text("Adverse Events")
    initQueryControls("aes","Adverse Events")

    //Drug /////////////////////////////////////////////////////////////////////////////
    var DrugRow = result_section.append("div").attr("class","drug-row results-row hidden")
    var DrugHead=DrugRow.append("div").attr("class","header-col")
    DrugHead.append("div").text("Drugs")
    initQueryControls("drug","Drugs")

    //Generic /////////////////////////////////////////////////////////////////////////////
    var GenericRow = result_section.append("div").attr("class","generic-row results-row hidden")
    var GenericHead=GenericRow.append("div").attr("class","header-col")
    GenericHead.append("div").text("Generic")
    initQueryControls("generic","Generics")

    //Manufacturer /////////////////////////////////////////////////////////////////////////////
    var ManufacturerRow = result_section.append("div").attr("class","manufacturer-row results-row hidden")
    var ManufacturerHead=ManufacturerRow.append("div").attr("class","header-col")
    ManufacturerHead.append("div").text("Manufacturer")
    initQueryControls("manufacturer","Manufacturers")

    //Count by year //////////////////////////////////////////////////////////////////////////////
    var TimingRow = result_section.append("div").attr("class","dates-row results-row")
    TimingRow.append("div").attr("class","header-col").text("Timing")

    var margin = {top: 20, right: 225, bottom: 30, left: 50},
        timing_width = 960 - margin.left - margin.right,
        timing_height = 200 - margin.top - margin.bottom;

    var x = d3.scale.linear()
        .range([0, timing_width]);

    var y = d3.scale.linear()
        .range([timing_height, 0]);

    var color = d3.scale.category10();

    var xAxis = d3.svg.axis()
        .orient("bottom")
        .tickFormat(d3.format(".0f"))
        .tickPadding(3);

    var yAxis = d3.svg.axis()
        .tickFormat(d3.format(".2s"))
        .orient("left");

    var line = d3.svg.line()
        .interpolate("linear")

    var svg = TimingRow.append("div").attr("class","timeChart query-result").append("svg")
        .attr("width", timing_width + margin.left + margin.right)
        .attr("height", timing_height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + timing_height + ")")

        svg.append("g")
        .attr("class", "y axis")
        .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("# of reports");

    /////////////////////////////////////////
    /// Function to update the comparison ///
    /////////////////////////////////////////
    var drawCharts = function(settings){
        // console.log(settings)
        //set up filter text
        var filterText = "";
        settings.filters.forEach(function(e){filterText = filterText+e.filterText})

        //Set up variables
        var currentVar = settings.comparisonVars.filter(function(e){return e.active})[0]
        var currentLevels = currentVar.options.filter(function(e){return e.active})     
        
        var allQueries = d3.merge(currentLevels.map(function(d){return d.queries}))
        var activeQueries = allQueries.filter(function(d){return d.results===null}) //only query levels with no data
        var numQueries = d3.sum(activeQueries, function(d){return d.queryText.length}) //Get number of queries to run
        var numLoaded=0;
        var numFailed=0;
        if(numQueries){
            //if new stuff, make API call and render
            currentLevels.forEach(function(groupLevel){
                groupLevel.queries.filter(function(d){return d.results===null}).forEach(function(queryObj){
                    queryObj.queryText.forEach(function(queryURL,i){
                        $.getJSON(queryURL, function(response){
                            // if(response.error){console.log}
                            numLoaded=numLoaded+1;                              
                            //console.log(queryURL)
                            if(queryObj.type=="raw"){
                                response.results.forEach(function(d){
                                    d.term =  queryObj.labels==null ? d.term : queryObj.labels(d.term)
                                })
                                queryObj.results = response.results;
                                //console.log(response.results)
                            }else if (queryObj.type=="ranges"){
                                if(queryObj.results===null) {queryObj.results=[]}
                                resultObj = {}
                                resultObj.term = queryObj.labels==null ? queryObj.ranges[i] : queryObj.labels(queryObj.ranges[i])
                                resultObj.count = response.meta.results.total
                                //console.log(resultObj)
                                queryObj.results.push(resultObj);
                            }
                            updateComparison()
                        })              
                    })
                })
            })
        }else{
            //if no new groups, just render (some groups may have been removed)
            updateComparison()
        }

        function updateComparison(){
            // console.log("Got "+numLoaded+" of "+ numQueries+" results. Not rendering yet.")
            if(numLoaded < numQueries) return; //Quit if the data isn't all loaded
            // console.log("Got "+numQueries+" results. Now rendering.")
            // console.log(settings)
            d3.select(".results").classed("hidden",false)
            d3.select("i.fa-spin").remove();
            d3.select(".search-box").select("input").property("value", "").on("input")()
            
            var currentVar = settings.comparisonVars.filter(function(e){return e.active})[0]
            var currentLevels = currentVar.options.filter(function(e){return e.active})  
            //Collapse the dates to 1 record per month

            currentLevels.forEach(function(currentLevel){
                if(!currentLevel.percentCalcDone){
                    //collapse dates to 1 record per year
                    var dateResults_raw = currentLevel.queries.filter(function(d){return d.label=="dates"})[0].results
                    var dateResults_yearly = d3.nest()
                    .key(function(d){return d.time.substring(0,4)})
                    .rollup(function(d){return d3.sum(d,function(e){return e.count})})
                    .entries(dateResults_raw)

                    var parseDate = d3.time.format("%Y%m%d").parse;
                    dateResults_yearly=dateResults_yearly.map(function(e){
                        return {
                            "year":e.key,
                            "date":parseDate(e.key+"0101"),
                            "count":e.values}})

                    currentLevel.queries.filter(function(d){return d.label=="dates"})[0].results = dateResults_yearly

                    //calculate percentages for each new query 
                    currentLevel.queries.forEach(function(query){
                        query.results.forEach(function(result){
                            result.total=query.missingAdj ? d3.sum(query.results,function(d){return d.count}) : currentLevel.count;
                            result.missing=currentLevel.count - result.total 
                            result.percent=result.count/result.total
                            result.percent_char=d3.format(".1%")(result.percent)
                        })
                    })
                    currentLevel.percentCalcDone=true
                }
            }) 
            
            /////////////////////////////////////////////////////////////////////////////////
            // Function to draw bars
            /////////////////////////////////////////////////////////////////////////////////
             function updateBars(cells, group, header, showCounts, sortAlpha, showMissing){ 
                cells.exit().remove();
                var new_pts = cells.enter().append("div").attr("class", "query-result");
                var new_ol = new_pts.append("ul")
                .attr("class",showCounts?"":"noCount")
                    .text(header)

                //scales 
                var width = 250
                var barHeight = 15
                var maxPercent = d3.max(cells.data(), function(e){
                    return d3.max(e.queries.filter(function(d){return d.label==group})[0].results,function(d){
                        return d.percent
                    })
                })
                var bar_x = d3.scale.linear()
                    .range([0,width-50])
                    .domain([0,maxPercent])

                var list = cells.select("ul")
                var items = list.selectAll("li.most-common")
                    .data(function(d){
                        var results = d.queries.filter(function(d){return d.label==group})[0].results
                        if(sortAlpha){return results.sort(function(a,b){return a.term > b.term})}
                        else{return results}
                    }, function(d){return d.term})

                var nuitems = items.enter()
                    .append("li")
                    .attr("class","most-common bars")
                    .classed("hidden",function(d,i){return i+1 > settings.nshown[group]})
                nuitems.append("div")
                .style("display","inline-block")
                .style("width","19px")
                    .text(function(d,i){return i<9 ? i+1+"  " : i+1+" "})
                var nu_bars = nuitems.append("svg")
                .attr("width",width)
                .attr("height",barHeight)
                    .append("g")

                var bar_groups = items.select("svg g")
                                
                //Overall
                nu_bars.append("rect")
                    .attr("height", barHeight)
                    .attr("x", 0)
                    .attr("width", function(d) {return bar_x(d.percent); })
                    .attr("fill","#bbb")

                nu_bars.append("line")
                    .attr("x1", function(d){return bar_x(d.percent)})
                    .attr("x2", function(d){return bar_x(d.percent)})
                    .attr("y1",0)
                    .attr("y2",barHeight)
                    .attr("stroke","#777")
                    .attr("stroke-width",2)

                            
                nu_bars.append("text")
                    .attr("class", "term")
                    .text(function(d){return smartCap(d.term)})
                    .attr("x",0)
                    .attr("y",barHeight/2)
                    .attr("dx", 3)
                    .attr("dy", ".35em")
                    .attr("text-anchor", "start")
                    .attr("stoke","black")
                    .style({"font-size": barHeight-3})

                nu_bars.append("text")
                    .text(function(d){return d.percent_char})
                    .attr("x", width)
                    .attr("y",barHeight/2)
                    .attr("dx", -5)
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("stoke","black")
                    .attr("class","hidden value")
                    .style("font-size", barHeight-3);
                
                bar_groups
                .on("mouseover",function(d){
                    if(!d3.select("."+group+"-row").classed("searching")){                      
                        cells.each(function(e){
                            var matchedBars = d3.select(this).selectAll("li.bars").filter(function(f){return f.term == d.term})
                            matchedBars.classed("hidden", false);
                            matchedBars.select("rect").attr("fill","lightBlue")
                            matchedBars.select("text.value").classed("hidden",false);
                        });     
                    }
                })
                .on("mouseout", function(){
                    if(!d3.select("."+group+"-row").classed("searching")){resetBars(group)}
                })

                //missing data info
                if(showMissing){
                    new_ol.append("li")
                    .datum(function(d){return d.queries.filter(function(d){return d.label==group})[0].results[0]})
                    .classed("missing",true)
                    .text(function(d){return d.missing+" reports with no value ("+d3.format(".0%")(d.missing/(d.total+d.missing))+")"})         
                }
            }

            /////////////////////////////////////////////////////////////////////////////////
            // Add "rows" (div.results-row) for each part of the comparison and 
            // then add fixed width "column" (div.query-result) for each drug/manufacturer
            /////////////////////////////////////////////////////////////////////////////////

            /////////////////////////////////////////////////////////////////////////////////
            // Header Row
            /////////////////////////////////////////////////////////////////////////////////       
            color.domain(currentLevels.map(function(d){return d.term}))

            var HeaderCells = HeaderRow.selectAll("div.query-result")
            .data(currentLevels,function(d){return d.term}) 

            var new_headers = HeaderCells.enter().append("div").attr("class", "query-result");
            new_headers.append("strong").attr("class","title")
            .text(function(d){return smartCap(d.term)})
            
            HeaderCells.style("color",function(d){return color(d.term)})
            HeaderCells.exit().remove()

            /////////////////////////////////////////////////////////////////////////////////
            // Counts Row
            /////////////////////////////////////////////////////////////////////////////////
            var CountCells=CountRow.selectAll("div.query-result")
            .data(currentLevels,function(d){return d.term}) 

            var new_counts = CountCells.enter().append("div").attr("class", "query-result");
            new_counts.append("span").text(function(d){return d.count.toLocaleString()+" reports"});;
            CountCells.exit().remove()

            /////////////////////////////////////////////////////////////////////////////////
            // Demographics - Gender Row
            /////////////////////////////////////////////////////////////////////////////////
            var GenderCells = GenderRow.selectAll("div.query-result").data(currentLevels,function(d){return d.term}) 
            updateBars(GenderCells,"gender", "", false, true, true)


            /////////////////////////////////////////////////////////////////////////////////
            // Demographics - Age Row
            /////////////////////////////////////////////////////////////////////////////////
            var AgeCells = AgeRow.selectAll("div.query-result").data(currentLevels,function(d){return d.term}) 
            updateBars(AgeCells,"age", "", false, true, true)

            /////////////////////////////////////////////////////////////////////////////////
            // AE Row - Bars
            /////////////////////////////////////////////////////////////////////////////////
            var PTcells = PTRow.selectAll("div.query-result").data(currentLevels,function(d){return d.term})
            updateBars(PTcells,"aes","", true, false, false)

            /////////////////////////////////////////////////////////////////////////////////
            // Drug Row - Bars
            /////////////////////////////////////////////////////////////////////////////////
            var Drugcells = DrugRow.selectAll("div.query-result").data(currentLevels,function(d){return d.term})
            updateBars(Drugcells,"drug","", true, false, false)

            /////////////////////////////////////////////////////////////////////////////////
            // Generic Row - Bars
            /////////////////////////////////////////////////////////////////////////////////
            var Genericcells = GenericRow.selectAll("div.query-result").data(currentLevels,function(d){return d.term})
            updateBars(Genericcells,"generic","", true, false, false)

            /////////////////////////////////////////////////////////////////////////////////
            // Manufacturer Row - Bars
            /////////////////////////////////////////////////////////////////////////////////
            var Manufacturercells = ManufacturerRow.selectAll("div.query-result").data(currentLevels,function(d){return d.term})
            updateBars(Manufacturercells,"manufacturer","", true, false, false)

            /////////////////////////////////////////////////////////////////////////////////
            // Timing Row
            /////////////////////////////////////////////////////////////////////////////////
            var timingData = currentLevels.map(function(d){
                 var obj={}
                 obj.term=d.term
                 obj.values=d.queries.filter(function(e){return e.label=="dates"})[0].results

                 //fill in data for years with 0 reports
                 return obj;
            })

            //get domains & update scales/axes
            x.domain(d3.extent(d3.merge(timingData.map(function(d){return d.values.map(function(e){return e.year})}))))
            y.domain(d3.extent(d3.merge(timingData.map(function(d){return d.values.map(function(e){return e.count})}))))
            xAxis.scale(x)
            yAxis.scale(y)
            svg.select("g.x.axis").transition().call(xAxis);
            svg.select("g.y.axis").transition().call(yAxis);

            line
            .x(function(d) { return x(d.year); })
            .y(function(d) { return y(d.count); });

            //Render lines
            var category = svg.selectAll("g.category")
                .data(timingData,function(d){return d.term})

            //remove old lines
            category.exit().remove()

            //add elements for new lines
            var new_lines = category.enter().append("g").attr("class", "category");
            new_lines.append("path").attr("class", "line")
            new_lines.selectAll("circle").data(function(d){
                d.values.forEach(function(e){e.term=d.term})
                return d.values
            }).enter().append("circle")
            new_lines.selectAll("text.annote").data(function(d){
                d.values.forEach(function(e){e.term=d.term})
                return d.values
            }).enter().append("text").attr("class","annote")

            new_lines.append("text").attr("class","title")
                
            //update positions for old and new elements
            category.selectAll("circle")
            .attr("r",3)
            .attr("cx",function(d){return x(d.year)})
            .attr("cy",function(d){return y(d.count)})
            .style("stroke",function(d){return color(d.term)})
            .style("stroke-width","2px")
            .style("fill","white")

             category.selectAll("text.annote")
            .attr("x",function(d){return x(d.year)})
            .attr("y",function(d){return y(d.count)-8})
            .attr("text-anchor","middle")
            .style("fill", function(d) {return color(d.term); })
            .text(function(d){return d3.format(".2s")(d.count)})
            .classed("hidden",true)

            category.select("path")
            .attr("d", function(d) { return line(d.values); })
            .style("stroke", function(d) {return color(d.term); })
            .style("stroke-width","2px")


            category.select("text.title")
            .attr("transform", function(d) {
                var last = d.values[d.values.length - 1]
                return "translate(" + x(last.year) + "," + y(last.count) + ")"; })
            .style("fill", function(d) { return color(d.term); })
            .text(function(d) {return d.term})
            .attr("x", 7)
            .attr("dy", ".35em")
            .attr("fill-opacity",0)

            category
            .on("mouseover",function(){
                category.selectAll("circle").classed("hidden",true)
                //category.select("text.title").style("fill-opacity",0.2)
                category.select("path").attr("stroke","#bbb").attr("stroke-opacity",0.2)

                d3.select(this).selectAll("text.annote").classed("hidden",false)
                d3.select(this).selectAll("circle").classed("hidden",false)
                d3.select(this).select("text.title").style("fill-opacity",1)
                d3.select(this).select("path").attr("stroke", function(d) {return color(d.term); }).attr("stroke-opacity",1)
            })
            .on("mouseout",function(){
                d3.select(this).selectAll("text.annote").classed("hidden",true)
                category.selectAll("circle").classed("hidden",false)
                category.select("text.title").style("fill-opacity",0)
                category.select("path").attr("stroke", function(d) {return color(d.term); }).attr("stroke-opacity",1)
            })
        }
    }



});
