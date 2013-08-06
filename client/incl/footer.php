<?php
$d = explode("/", trim($path, "/"));
$srcUrl = '../source.php?dir=' . end($d) . '&amp;file=' . basename($_SERVER["PHP_SELF"]) . '#file';
?>

		<footer id='footer'>
			<p>Pinky: <em>Gee, Brain, what do you want to do tonight?</em><br />
				Brain: <em>The same thing we do every night, Pinky - try to take over the <a href='<?= $srcUrl ?>'>source</a>!</em></p>

			<nav>Validatorer: 
				<a href='http://validator.w3.org/check/referer'>HTML5</a>
				<a href='http://jigsaw.w3.org/css-validator/check/referer?profile=css3'>CSS3</a>
				<a href='http://validator.w3.org/unicorn/check?ucn_uri=referer&amp;ucn_task=conformance'>Unicorn</a>
				<a href='http://csslint.net/'>CSS-lint</a>
				<a href='http://jslint.com/'>JS-lint</a>
			</nav>
		</footer>
		<script src="scripts/jquery.js"></script>
		<script src="scripts/mos.js"></script>
		<script src="scripts/janey.js"></script>
		<script src="scripts/main.js"></script>
	</body>
</html>
