<?php
// Set the correct headers
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// First set the input variables
if(!isset($_GET["title"])) {
    if(!isset($_POST["title"])) {
        echo '{"success": false, "error": "paramnotspecified"}';
        exit(1);
    }else{
        $title = $_POST["title"];
    }
}else{
    $title = $_GET["title"];
}

if(!isset($_GET["revid"])) {
    if(!isset($_POST["revid"])) {
        $revid = null;
    }else{
        $revid = $_POST["revid"];
    }
}else{
    $revid = $_GET["revid"];
}

$debug = isset($_GET["debug"]) || isset($_POST["debug"]);

// Get Wikipedia metadata about this article, including full markup
include "wikipediaapi.inc.php";
$apiclient = new WikiApiClient($title, $revid);
$apiclient->fetch();

// TODO: Try to fetch and return cached entry from database
// TODO: When revid is specified this could be done even sooner

// No cached entry: Get markup from wikiwho api
$url = "http://193.175.238.123/wikiwho/wikiwho_api_api.py";
$url .= "?revid=" . urlencode($apiclient->revid);
$url .= "&name=" . urlencode($title);
$url .= "&format=json";
$url .= "&params=author";
if($debug) echo $url."\n";
$ch = curl_init();
$timeout = 10;
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_USERAGENT, "API used by Wikicolor-Server for coloring wikipedia pages based on authors. Email uadjb@student.kit.edu");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);

// Use special demo data if possible
if($title=="Gamergate controversy" && $apiclient->revid==646318209) {
  echo file_get_contents("./gamergate_646318209_final.json");
  exit(0);
  //$data = file_get_contents("./gamergate_646318209.json");
}else{
  $data = curl_exec($ch);
  curl_close($ch);
}

// Parse Wikiwho API response
try {
    $wikiwhoJSON = json_decode($data, true);
} catch (Exception $e) {
    echo json_encode(array("success" => false, "reason" => "Exception when parsing Wikiwho JSON."));
    exit(1);
}

if ($wikiwhoJSON==null) {
    echo json_encode(array("success" => false, "reason" => "Wikiwho JSON was null"));
    exit(2);
}

// Extract tokens from Wikiwho API response
$wikiwhoTokens = reset($wikiwhoJSON["revisions"])["tokens"];

// Prepare final markup
include "markuppreparser.inc.php";
$parser = new WikiMarkupPreparser($apiclient->fullmarkup, $wikiwhoTokens, $apiclient);
$parser->DEBUG = $debug;
if($parser->extendMarkup()) {
    $markup = $parser->extendedmarkup;
}else{
    echo json_encode(array("success" => false, "reason" => "Error preparsing the markup: ".$parser->error));
    exit(5);
}

// Generate html via wikipedia api
$url = "http://en.wikipedia.org/w/api.php";
$fieldstr = "action=parse";
$fieldstr .= "&title=" . urlencode($title);
$fieldstr .= "&text=" . urlencode($markup);
$fieldstr .= "&format=json";
$ch = curl_init();
$timeout = 10;
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_USERAGENT, "API used by Wikicolor-Server for coloring wikipedia pages based on authors. Email uadjb@student.kit.edu");
curl_setopt($ch,CURLOPT_POST, 4);
curl_setopt($ch,CURLOPT_POSTFIELDS, $fieldstr);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
$data = curl_exec($ch);
curl_close($ch);

// Parse Wikipedia API response
try {
    $generatedHTML = json_decode($data, true)["parse"]["text"]["*"];
} catch (Exception $e) {
    echo json_encode(array("success" => false));
    exit(3);
}

if (!$generatedHTML) {
    echo json_encode(array("success" => false));
    exit(4);
}
if($debug) {
  echo json_encode(array("markup" => $markup, "html" => $generatedHTML));
}else{
  echo json_encode(array("success" => true, "html" => $generatedHTML, "revisions" => $apiclient->revisions, "authors" => $apiclient->authors, "authors_current" => $apiclient->authorspresent, "tokens" => $parser->tokens, "tokencount" => count($wikiwhoTokens), "revid" => $apiclient->revid));
}
?>
