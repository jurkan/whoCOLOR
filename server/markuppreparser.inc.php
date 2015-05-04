<?php
class WikiMarkupPreparser {
  public $DEBUG = false;

  protected $specialmarkup = array(
    # Interwiki links
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/\[\[/',
      'endmarker' => '/\]\]/',
      'breakspans' => false,
    ),

    # External links
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/\[/',
      'endmarker' => '/\]/',
      'breakspans' => false
    ),

    # Template tags and similar
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/{{/',
      'endmarker' => '/}}/',
      'breakspans' => true
    ),

    # Reference tags
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/<ref/',
      'endmarker' => '/>/',
      'breakspans' => true
    ),

    # Math tags
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/<math[^>]*>/',
      'endmarker' => '/<\\/math>/',
      'breakspans' => true
    ),

    # General HTML tags
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/</',
      'endmarker' => '/>/',
      'breakspans' => false
    ),

    # Headings
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/(?<=WIKICOLORLB)=+/',
      'breakspans' => true
    ),
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/=+(?=WIKICOLORLB)/',
      'breakspans' => true
    ),

    # Lists and blocks
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/(?<=WIKICOLORLB)[\\*#\\:]*;/',
      'endmarker' => '/\\:/',
      'breakspans' => true
    ),
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/(?<=WIKICOLORLB)[\\*#:]+/',
      'breakspans' => true
    ),

    # Horizontal lines
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/(?<=WIKICOLORLB)-----*/',
      'breakspans' => true
    ),

    # Table formatting
    #array(
    #  'type' => 'single',
    #  'func' => 'parseSpecialMarkupToken',
    #  'startmarker' => '/(?<=WIKICOLORLB)({\\||\\|}|\\|-|\\|\\+|\\|\\||)/',
    #  'breakspans' => true
    #),
    array(
      'type' => 'block',
      'func' => 'parseStandardBlock',
      'startmarker' => '/(?<=WIKICOLORLB)\\{\\|/',
      'endmarker' => '/(?<=WIKICOLORLB)\\|\\}/',
      'breakspans' => true
    ),

    # Linebreaks
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/(WIKICOLORLB)+/',
      'breakspans' => true
    ),

    # HTML Escape Sequences
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/(&nbsp;|&euro;|&quot;|&amp;|&lt;|&gt;|&nbsp;|&(?:[a-z\d]+|#\d+|#x[a-f\d]+);)/',
      'breakspans' => true
    ),

    # Magic words
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/__(NOTOC|FORCETOC|TOC|NOEDITSECTION|NEWSECTIONLINK|NONEWSECTIONLINK|NOGALLERY|HIDDENCAT|NOCONTENTCONVERT|NOCC|NOTITLECONVERT|NOTC|START|END|INDEX|NOINDEX|STATICREDIRECT|DISAMBIG)__/',
      'breakspans' => true
    ),

    # Apostrophes for formatting
    array(
      'type' => 'single',
      'func' => 'parseSpecialMarkupToken',
      'startmarker' => '/\'\'+/',
      'breakspans' => false
    ),
  );

  # Saves trace of all blocks we're in currently for debugging purposes
  protected $blocktrace = array();

  # Saves the full wikipedia markup and all wikiwho tokens
  protected $fullmarkup;
  public $tokens;

  # Saves the current position of the preparser
  protected $tokenindex = 0;
  protected $markuppos = 0;

  # Saves whether there currently is an open span tag
  protected $openspan = false;

  # Required to provide sequence data
  protected $prevauthor = false;

  # Array that holds the starting positions of blocks we already jumped into
  protected $jumpedelems = array();

  # The return values of the parser (error can be an error description)
  public $extendedmarkup;
  public $error = false;

  /*
   * Constructor; Takes fullmarkup and Wikiwho token array
   */
  function __construct($fullmarkup, $tokens, $wikiapidata) {
    //$this->fullmarkup = $fullmarkup;
    $this->fullmarkup = preg_replace('/[\n\r]/',"WIKICOLORLB",$fullmarkup);
    $this->tokens = $tokens;
    $this->wikiapidata = $wikiapidata;
  }

  /*
   * Extends the markup with span tags providing author information
   */
  function extendMarkup() {
    $this->extendedmarkup = "";

    $result = $this->basicParsingLoop();
    $extendedmarkup = preg_replace('/WIKICOLORLB/',"\n",$this->extendedmarkup);
    $this->extendedmarkup = $extendedmarkup;

    usort($this->wikiapidata->authorspresent, $this->buildAuthorSorter());

    return $result;
  }

  private function buildAuthorSorter() {
    return function ($a, $b) {
      if ($a["count"] == $b["count"]) {
        return 0;
      }
      return ($a["count"] > $b["count"]) ? -1 : 1;
    };
  }

  private function getToken() {
    if($this->DEBUG) {
      echo "Get token with index ".$this->tokenindex." from ".count($this->tokens)." tokens\n";
    }
    if ($this->tokenindex < count($this->tokens)) {
      $token = $this->tokens[$this->tokenindex];
      $token["index"] = $this->tokenindex;

      if(!isset($token["start"])) {
        $strpos = stripos($this->fullmarkup, $token["str"], $this->markuppos);
        $token["start"] = $strpos;

        if($strpos === false) {
          if($this->DEBUG) {
            echo "Error: Token not found in markup\n";
          }
          $this->error = "Token not found in markup";
          return false; # TODO: Handle this error correctly
        }

        $token["end"] = $strpos + strlen($token["str"]);

        $token["authorid"] = $this->wikiapidata->revisions[$token["revid"]]["userid"];

        if(isset($this->wikiapidata->authorspresent[$token["authorid"]])) {
          $this->wikiapidata->authorspresent[$token["authorid"]]["count"] = $this->wikiapidata->authorspresent[$token["authorid"]]["count"] + 1;
        }else{
          $this->wikiapidata->authorspresent[$token["authorid"]] = array("count" => 1, "authorid" => $token["authorid"]);
        }

        $this->tokens[$this->tokenindex] = $token;
      }
    }else{
      $token = false;
    }

    return $token;
  }

  private function getNextSpecialMarkup() {
    # Get starting position of next special markup element
    $nextelem = array(
      "start" => false
    );
    foreach ($this->specialmarkup as $elem) {
      $elemstart = $this->getFirstRegexPos($elem["startmarker"], $this->markuppos);
      if((!($elemstart === false)) && (($nextelem["start"] === false) || ($nextelem["start"] > $elemstart[1]))) {
        if(!(in_array($elemstart[1], $this->jumpedelems))) {
          $nextelem = $elem;
          $nextelem["start"] = $elemstart[1];
          $nextelem["startlen"] = strlen($elemstart[0]);

          if($nextelem["type"] == "single") {
            $nextelem["endlength"] = $nextelem["startlen"];
            $nextelem["end"] = $nextelem["start"];
          }
        }
      }
    }

    if(!($nextelem["start"] === false)) {
      if ($this->DEBUG) echo "Next special element start: ".$nextelem["startmarker"]." AT ".$nextelem["start"]." WITH LENGTH ".$nextelem["startlen"]." AND TYPE ".$nextelem["type"]."\n";
    }else{
      if ($this->DEBUG) echo "Next special element start: none\n";
    }

    if($nextelem["start"] === false) {
      $nextelem = false;
    }

    return $nextelem;
  }

  private function getEndmarkerPosition($endmarker) {
    # Get endmarker position
    $result = array(
      "start" => false
    );
    if($endmarker) {
      if(isset($endmarker["endlength"]) && isset($endmarker["end"])) {
        $result["len"] = $endmarker["endlength"];
        $result["start"] = $endmarker["end"];
        $result["end"] = $result["start"]+$result["len"];
      }else{
        $endmark = $this->getFirstRegexPos($endmarker["endmarker"], $this->markuppos);
        if(!($endmark === false)) {
          $result["len"] = strlen($endmark[0]);
          $result["start"] = $endmark[1];
          $result["end"] = $result["start"]+$result["len"];
        }
      }
    }
    if ($this->DEBUG) {
      if ($result["start"] == false) {
        echo "Endmarker position: None\n";
      }else{
        echo "Endmarker position: ".$result["start"]." WITH LENGTH ".$result["len"]." AND END ".$result["end"]."\n";
      }
    }

    if($result["start"] === false) $result = false;

    return $result;
  }

  private function basicParsingLoop($addmarks=true,$endmarker=false,$nojump=false) {
    # Debug message to indicate a new loop method call
    if ($this->DEBUG) echo "-----------------------------------------------\n";

    # Helper variable for ending the loop graciously after ending one execution
    $endloop = false;

    # Current wikiwho token
    $token = $this->getToken();

    # Get endmarker position
    if($endmarker) {
      $endmark = $this->getEndmarkerPosition($endmarker);
    }else{
      $endmark = false;
    }

    # Get starting position of next special markup element
    $specialelem = $this->getNextSpecialMarkup();

    while($this->markuppos < (strlen($this->fullmarkup)-1)) {
      if (!$token) {
        # No token left to parse - simple close the spans and add everything that's left to the end of the markup
        if ($this->DEBUG) echo "\n";
        if ($this->DEBUG) echo "No token left to parse - simple close the spans and add everything that's left to the end of the markup\n";
        $this->extendedmarkup .= substr($this->fullmarkup,$this->markuppos,strlen($this->fullmarkup)-1-$this->markuppos);
        if ($this->DEBUG) echo "Adding to new markup: " . substr($this->fullmarkup,$this->markuppos,strlen($this->fullmarkup)-1-$this->markuppos) . "\n";
        $this->markuppos = strlen($this->fullmarkup)-1;

        if ($this->DEBUG) echo "Leaving block/loop.\n";

        # As endmarker has been matched, return true
        return true;
      }
      if ($this->DEBUG) {
        echo "-----------------------------------------------\n";
        echo "Markup position: ".$this->markuppos."\n";
        echo "Token: ".$token["str"]."\n";
        echo "Token starting position: ".$token["start"]."\n";
        echo "Token end position: ".$token["end"]."\n";

        if($endmark) {
          echo "Endmark starting position: ".$endmark["start"]."\n";
          echo "Endmark ending position: ".$endmark["end"]."\n";
        }

        echo "Blocktrace";
        foreach ($this->blocktrace as $value) {
          echo " -- ".$value;
        }
        echo "\n";
      }

      # Don't jump anywhere if nojump is set or if in the endmarker
      if(!($nojump) && (!$endmark || $this->markuppos < $endmark["start"])) {
        # Test whether we have to skip another special markup element
        if ($this->DEBUG) echo "Is the next special markup element starting before the end of the token (and no endmarker conflicting)?\n";
        if($specialelem && ((!$endmark)||($specialelem["start"] < $endmark["start"])) && ($specialelem["start"] < $token["end"])) {
          # Blockintro was found before or reaching into token
          # Jump with execution into specific function for that block type
          $this->jumpedelems[] = $specialelem["start"];
          if ($this->DEBUG) echo "Answer: Yes, JUMPING after having added marks in case we may do that.\n";
          if($addmarks && $specialelem["breakspans"]) {
            $this->addSpans($token, true);
          }else if($addmarks){
            $this->addSpans($token, false, true);
          }
          if(!call_user_func(array($this, $specialelem["func"]), $specialelem)) {
            return false;
          }

          # Current wikiwho token
          $token = $this->getToken();

          # Get endmarker position
          if($endmarker) $endmark = $this->getEndmarkerPosition($endmarker);

          # Get starting position of next special markup element
          $specialelem = $this->getNextSpecialMarkup();

          if($addmarks && $specialelem["breakspans"]) {
            #$this->addSpans($token);
          }

          continue;
        }
        if ($this->DEBUG) echo "Answer: No.\n";
      } # ENDJUMPCHECKS

      # Has endmarker been matched?
      if($endmark) {
          if ($this->DEBUG) echo "Does the endmarker end before the token?\n";
          if($endmark["end"] < $token["end"]) {
              # Endmarker has been matched before the token
              # => Set position to endmarkers end
              if ($this->DEBUG) echo "Answer: Yes, before the token.\n";
              if ($this->DEBUG) echo "Setting markuppos from ".$this->markuppos." to ".($endmark["end"])."\n";
              $this->extendedmarkup .= substr($this->fullmarkup,$this->markuppos,$endmark["end"]-$this->markuppos);
              if ($this->DEBUG) echo "Adding to new markup: " . substr($this->fullmarkup,$this->markuppos,$endmark["end"]-$this->markuppos) . "\n";
              $this->markuppos = $endmark["end"];

              if ($this->DEBUG) echo "Leaving block/loop.\n";

              # As endmarker has been matched, return true
              return true;
          }else{
              if ($this->DEBUG) echo "Answer: No.\n";
          }
      }

      # Add sequence author tags around token
      //if((($this->prevauthor===false) || $this->prevauthor != $author) && ($addmarks)) {
      //    if(!($this->prevauthor===false)) {
      //        $this->extendedmarkup .= '</span>';
      //    }
      //    $this->extendedmarkup .= '<span class="author-sequence sequence-author-'.$author.'">';
      //    $this->prevauthor = $author;
      //}
      if($addmarks) {
          $this->addSpans($token);
      }

      # add remaining token (and possible preceding chars) to resulting altered markup
      $this->extendedmarkup .= substr($this->fullmarkup,$this->markuppos,$token["end"]-$this->markuppos);
      if ($this->DEBUG) echo "Adding to new markup: " . substr($this->fullmarkup,$this->markuppos,$token["end"]-$this->markuppos) . "\n";
      $this->markuppos = $token["end"];

      # Increase tokenindex
      $this->tokenindex++;

      # Set new token
      $token = $this->getToken();
    }

    if ($this->DEBUG) echo "Leaving block/loop.\n";

    # Close opened tags
    if((!($this->prevauthor === false))&&(!$endloop)) {
      $this->extendedmarkup .= "</span>";
    }

    # Finished this loop successfully so return true
    return true;
  }

  private function getFirstRegexPos($regex, $start=0) {
    if (preg_match_all($regex, $this->fullmarkup, $matches, PREG_OFFSET_CAPTURE) >= 1) {
      $firstmatch = false;
      foreach ($matches[0] as $match) {
        if((($firstmatch === false) || ($firstmatch[1] > $match[1])) && ($match[1] >= $start)) {
          $firstmatch = $match;
        }
      }
    }else{
      $firstmatch = false;
    }

    if ($this->DEBUG) echo "First Regex position of: " . $regex . "  BEGINNING AT  " . $start . "  AT POSITION  " . $firstmatch[1];
    if ($firstmatch === false) {
      if ($this->DEBUG) echo "no match";
    }
    if ($this->DEBUG) echo "\n";

    return $firstmatch;
  }

  private function addSpans($token, $closeonly=false, $openonly=false) {
    if(isset($token["authorid"])) {
        $author = "token-authorid-" . $token["authorid"];
    }else{
        $author = "token-authorname-" . $token["author_name"];
    }

    if($this->openspan) {
      if($openonly) return;
      $this->extendedmarkup .= '</span>';
      $this->openspan = false;
      if ($this->DEBUG) echo "Adding closing span.\n";
    }

    if(!$closeonly) {
      $this->extendedmarkup .= '<span class="author-token '.$author.' author-tokenid-'.$token["index"].'">';
      $this->prevauthor = $author;
      $this->openspan = true;
      if ($this->DEBUG) echo "Adding opening span.\n";
    }
  }

  private function parseStandardBlock($elemdata) {
    if ($this->DEBUG) echo "JUMPINBLOCK ".$elemdata["startmarker"]."\n";
    $this->blocktrace[] = $elemdata["startmarker"];
    $result = $this->basicParsingLoop(false, $elemdata);
    $block = array_pop($this->blocktrace);
    if ($this->DEBUG) echo "LEFTBLOCK ".$block."\n";
    return $result;
  }

  private function parseSpecialMarkupToken($elemdata) {
    if ($this->DEBUG) echo "SPECIALTOKEN ".$elemdata["startmarker"]."\n";
    $this->blocktrace[] = $elemdata["startmarker"];
    $result = $this->basicParsingLoop(false, $elemdata, true);
    $specialtoken = array_pop($this->blocktrace);
    if ($this->DEBUG) echo "LEFTSPECIALTOKEN ".$specialtoken."\n";
    return $result;
  }
}
?>
