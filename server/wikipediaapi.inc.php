<?php
class WikiApiClient {
    // If true, debug output will be shown
    public $DEBUG = false;
    // These are output variables
    public $revisions = array();
    public $authors = array();
    // Filled by the premarkupparser; contains a list of all authors (name and id)
    // present in the currently viewed revision
    public $authorspresent = array();
    // This is the base URL for accessing the wikipedia api
    private $APIURL = "http://en.wikipedia.org/w/api.php";
    /*
     * Constructor; Takes article name and revision id
    */
    function __construct($articlename, $revid = null) {
        //$this->fullmarkup = $fullmarkup;
        $this->articlename = $articlename;
        $this->revid = $revid;
    }
    /*
     * Fetch all necessary data
    */
    public function fetch() {
        $this->fetchCurrentContent();
        $this->fetchRevisions();
    }
    private function fetchCurrentContent() {
        // Get Wikipedia metadata about this article, including full markup
        $url = $this->APIURL . "?action=query&prop=revisions&rvlimit=1&rvprop=ids|content&format=json";
        if (!($this->revid === null)) {
            $url.= "&rvstartid=" . urlencode($this->revid);
            $url.= "&rvendid=" . urlencode($this->revid);
        }
        $url.= "&titles=" . urlencode($this->articlename);
        $ch = curl_init();
        $timeout = 10;
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
        $data = curl_exec($ch);
        curl_close($ch);
        // Parse wikipedia API response
        try {
            $wikimediaresponse = json_decode($data, true);
            $this->fullmarkup = reset(reset($wikimediaresponse["query"]["pages"]) ["revisions"]) ["*"];
            if ($this->revid === null) {
                $this->revid = reset(reset($wikimediaresponse["query"]["pages"]) ["revisions"]) ["revid"];
            }
        }
        catch(Exception $e) {
            echo json_encode(array("success" => false, "reason" => "Exception when parsing Wikipedia JSON."));
            exit(1);
        }
    }
    private function fetchRevisions($continue = null) {
        // Get Wikipedia metadata about this article, including full markup
        $url = $this->APIURL . "?action=query&prop=revisions&rvlimit=max&rvprop=ids|timestamp|user|userid|comment&format=json&continue=";
        if (!($continue === null)) {
            $url.= $continue["continue"];
            unset($continue["continue"]);
            foreach ($continue as $key => $value) {
                $url.= "&" . urlencode($key) . "=" . urlencode($value);
            }
        }
        $url.= "&titles=" . urlencode($this->articlename);
        $ch = curl_init();
        $timeout = 10;
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
        $data = curl_exec($ch);
        curl_close($ch);
        // Parse wikipedia API response
        try {
            $wikimediaresponse = json_decode($data, true);
            $revisions = reset($wikimediaresponse["query"]["pages"]) ["revisions"];
            foreach ($revisions as $rev) {
                $revdata = array("timestamp" => $rev["timestamp"], "parentid" => $rev["parentid"]);
                if(isset($rev["comment"])) {
                  $revdata["comment"] = $rev["comment"];
                }
                if (isset($rev["anon"])) {
                    $userkey = md5($rev["user"]);
                } else {
                    $userkey = $rev["userid"];
                }
                $revdata["userid"] = $userkey;
                if (!isset($this->authors[$userkey])) {
                    $this->authors[$userkey] = array("name" => $rev["user"], "anon" => isset($rev["anon"]), "revs" => array());
                }
                $this->authors[$userkey]["revs"][] = $rev["revid"];
                $this->revisions[$rev["revid"]] = $revdata;
            }
        }
        catch(Exception $e) {
            echo json_encode(array("success" => false, "reason" => "Exception when parsing Wikipedia JSON."));
            exit(1);
        }
        if (isset($wikimediaresponse["continue"])) {
            $this->fetchRevisions($continue = $wikimediaresponse["continue"]);
        }
    }
}
?>
