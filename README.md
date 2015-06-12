<h1>Overview</h1>
<p> The OpenFDAExplorer (<a href="http://graphics.rhoworld.com/tools/OpenFDA/">Demo Site</a>) lets users explore more than 3.5 million adverse event reports collected between 1/1/2004 and 1/1/2015 from the <a href="https://open.fda.gov/">openFDA project</a>. </p>

<h1>Details</h1>
<p><a href="https://open.fda.gov/">OpenFDA</a> is an initiative that allows open access to large public FDA datasets covering topics including adverse events, recalls, and labeling. The adverse event database includes over 3.5 million adverse events collected over more than 10 years. Each report includes a wide variety of information about the adverse event (MEDRA preferred terms, resolution, severity, etc.), the compound (National Drug Code (NDC) number, route, dosage, etc.) and the participant (age, sex, weight, etc.). The project includes a well-documented Application Programming Interface (API) that allows users to access specific subsets of adverse events based on the many criteria included in the reports.The openFDA website (open.fda.gov) provides many additional details on this initiative.</p>

<p>The openFDA site does not provide tools that allow a general user to explore these datasets, so we have developed this project using openFDA database and API. The OpenFDA Explorer connects an intuitive graphical user interface to the openFDA API allowing any user to query the database in real time. Users can to compare report characteristics (e.g., preferred term or demographics characteristics) across subgroups of interest (such as compound, manufacturer).</p>

<h1>Dependencies</h1>
<ul>
	<li> <a href="http://getbootstrap.com/">Bootstrap</a></li>
	<li> <a href="https://github.com/davidstutz/bootstrap-multiselect">Bootstrap-Multiselect</a></li>
	<li> <a href="http://www.d3js.org">D3</a></li>
</ul>

<h1>Set-up</h1>
Two div elements are required to render the chart. One with classes "controls" and "ig-controls" and the second with classes "viz" and "barchart".
