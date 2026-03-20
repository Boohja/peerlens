<script>
	import Collapsible from '$lib/Collapsible.svelte';
	import imgTraffic from '$lib/assets/data/traffic.webp';
	import imgSessionPhone from '$lib/assets/data/phone-session.png';
	import imgSessionViewer from '$lib/assets/data/viewer-session.png';
</script>

<svelte:head>
	<title>PeerLens Data</title>
</svelte:head>

<div class="page">
	<div class="card">
		<section class="hero mb-7">
			<div class="grid gap-6">
				<p class="eyebrow">Data details</p>
				<h1>The data we handle</h1>
				<p class="lede">
					When you scan the QR code, your devices exchange a small amount of connection information — similar to
					exchanging phone numbers.
				</p>
			</div>
			<div class="hero-visual" aria-hidden="true">
        <img src="{imgTraffic}" alt="Illustration of IPv6 connectivity" />
      </div>
		</section>
		<p class="lede mb-0">
			After that, they talk <strong>directly to each other over your local network</strong>. No video data is sent to
			PeerLens servers at any point.
		</p>
	</div>

	<section class="card">
		<h2 class="section-title">What data is exchanged during setup</h2>
		<p>
			To establish the connection, PeerLens briefly stores two types of technical data.
		</p>

		<a id="sdp" aria-hidden="true"></a>
		<div class="subtle-card">
			<div class="icon-chip" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round">
					<path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" />
					<path d="M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z" />
					<path d="M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z" />
					<path d="M10 8.5L17 8.5" />
					<path d="M14 15.5L7 15.5" />
				</svg>
			</div>
			<div>
				<h3>Session data (the connection description)</h3>
				<p>
					This includes how devices can communicate (for example supported formats), plus connection
					state and timestamps.
				</p>
				<p class="py-3">“Here's how I can send video.”</p>
				<div class="stacked-cards">
					<Collapsible title="Viewer: Example SDP data">
						<div class="code">
							<div class="area">
								<span class="area-label">Session & bundling</span>
								v=0
								o=- 1592731983626769296 2 IN IP4 127.0.0.1
								s=-
								t=0 0
								a=group:BUNDLE 0
								a=extmap-allow-mixed
								a=msid-semantic: WMS
							</div>
							<div class="area">
								<span class="area-label">Media & connection</span>
								m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 35 36 37 38 103 104 107 108 109 114 115 116 117 118 39 40 41 42 43 44 45 46 47 48 119 120 121 122 49 50 51 52 123 124 125 53
								c=IN IP4 0.0.0.0
								a=rtcp:9 IN IP4 0.0.0.0
							</div>
							<div class="area">
								<span class="area-label">Transport security (DTLS & ICE)</span>
								a=fingerprint:sha-256 7E:C4:EE:8A:7D:04:31:B2:E2:CE:A4:E8:35:83:D2:4E:3C:BC:BB:49:D3:F5:75:A6:AE:ED:CC:66:8C:58:9E:F9
								a=setup:actpass
								a=ice-ufrag:uLIy<br>
								<mark>a=ice-pwd:AI/BkgrC3MM23xQB8EwdynaG</mark><br>
								a=ice-options:trickle
							</div>
							<div class="area">
								<span class="area-label">Session configuration</span>
								a=mid:0
								a=recvonly
								a=rtcp-mux
								a=rtcp-rsize
							</div>
							<div class="area">
								<span class="area-label">RTP header extensions</span>
								a=extmap:1 urn:ietf:params:rtp-hdrext:toffset
								a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
								a=extmap:3 urn:3gpp:video-orientation
								a=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
								a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
								a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
								a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
								a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
								a=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid
								a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
								a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
							</div>
							<div class="area">
								<span class="area-label">Codec parameters</span>
								a=rtpmap:96 VP8/90000
								a=rtcp-fb:96 goog-remb
								a=rtcp-fb:96 transport-cc
								a=rtcp-fb:96 ccm fir
								a=rtcp-fb:96 nack
								a=rtcp-fb:96 nack pli
								a=rtpmap:97 rtx/90000
								a=fmtp:97 apt=96
								a=rtpmap:98 VP9/90000
								a=rtcp-fb:98 goog-remb
								a=rtcp-fb:98 transport-cc
								a=rtcp-fb:98 ccm fir
								a=rtcp-fb:98 nack
								a=rtcp-fb:98 nack pli
								a=fmtp:98 profile-id=0
							</div>
							...
						</div>
						<hr class="my-4" />
						<p>
							<mark>*)</mark> the "ice-pwd" is a temporary password for the connection, generated by the browser. It is not a secret and does not need to be protected like a password for an online account would be.
						</p>
					</Collapsible>
					<Collapsible title="Phone: Example SDP data">
						<div class="code">
							<div class="area">
								<span class="area-label">Session & bundling</span>
								v=0
								o=- 52783187136577110 2 IN IP4 127.0.0.1
								s=-
								t=0 0
								a=group:BUNDLE 0
								a=extmap-allow-mixed
								a=msid-semantic: WMS 55073c60-da8f-4cf5-a329-d995b89df2d6
							</div>
							<div class="area">
								<span class="area-label">Media & connection</span>
								m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 109 114 115 116 45 46 49 50 123 124 125
								c=IN IP4 0.0.0.0
								a=rtcp:9 IN IP4 0.0.0.0
							</div>
							<div class="area">
								<span class="area-label">Transport security (DTLS & ICE)</span>
								a=fingerprint:sha-256 CD:CE:A7:62:01:F5:3F:A9:E5:3B:56:78:40:57:1A:A1:C5:1B:16:62:84:B7:86:41:D6:8D:90:46:B1:16:0C:84
								a=setup:active
								a=ice-ufrag:Fbs5<br>
								<mark>a=ice-pwd:p8Psrc+iUgmBtCCom4HkpPw5</mark><br>
								a=ice-options:trickle
							</div>
							<div class="area">
								<span class="area-label">Session configuration</span>
								a=mid:0
								a=sendonly
								a=msid:55073c60-da8f-4cf5-a329-d995b89df2d6 076cc107-f5c5-41c6-a3a0-05d6bda58097
								a=rtcp-mux
								a=rtcp-rsize
							</div>
							<div class="area">
								<span class="area-label">RTP header extensions</span>
								a=extmap:1 urn:ietf:params:rtp-hdrext:toffset
								a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
								a=extmap:3 urn:3gpp:video-orientation
								a=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
								a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
								a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
								a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
								a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
								a=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid
								a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
								a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
							</div>
							<div class="area">
								<span class="area-label">Codec parameters</span>
								a=rtpmap:96 VP8/90000
								a=rtcp-fb:96 goog-remb
								a=rtcp-fb:96 transport-cc
								a=rtcp-fb:96 ccm fir
								a=rtcp-fb:96 nack
								a=rtcp-fb:96 nack pli
								a=rtpmap:97 rtx/90000
								a=fmtp:97 apt=96
								a=rtpmap:98 VP9/90000
								a=rtcp-fb:98 goog-remb
								a=rtcp-fb:98 transport-cc
								a=rtcp-fb:98 ccm fir
								a=rtcp-fb:98 nack
								a=rtcp-fb:98 nack pli
								a=fmtp:98 profile-id=0
								a=rtpmap:99 rtx/90000
								a=fmtp:99 apt=98
								a=rtpmap:100 VP9/90000
								a=rtcp-fb:100 goog-remb
								a=rtcp-fb:100 transport-cc
								a=rtcp-fb:100 ccm fir
								a=rtcp-fb:100 nack
								a=rtcp-fb:100 nack pli
								a=fmtp:100 profile-id=2
								a=rtpmap:101 rtx/90000
								a=fmtp:101 apt=100
								a=rtpmap:109 H264/90000
							</div>
							<div class="area">
								<span class="area-label">Stream identification (SSRC)</span>
								a=ssrc-group:FID 2326129041 1819159134
								a=ssrc:2326129041 cname:Tg0oVuy26MHukXfq
								a=ssrc:1819159134 cname:Tg0oVuy26MHukXfq
							</div>
							...
						</div>
						<hr class="my-4" />
						<p>
							<mark>*)</mark> the "ice-pwd" is a temporary password for the connection, generated by the browser. It is not a secret and does not need to be protected like a password for an online account would be.
						</p>
					</Collapsible>
				</div>
				<p class="pt-3 mb-0">
					You can access all SDP data inside of your session info modal, available by clicking on your session shorthand in the navbar.
				</p>
				<p class="pt-3 mb-0">
					Check out <a class="link" href="https://webrtchacks.com/sdp-anatomy/" target="_blank" rel="noopener">https://webrtchacks.com/sdp-anatomy/</a> for a detailed breakdown of what all this means.
				</p>
			</div>
		</div>

		<a id="ice" aria-hidden="true"></a>
		<div class="subtle-card">
			<div class="icon-chip" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 10V9.21749C22 7.27787 22 6.30807 21.4142 5.7055C20.8284 5.10294 19.8856 5.10294 18 5.10294H15.9214C15.004 5.10294 14.9964 5.10116 14.1715 4.68834L10.8399 3.02114C9.44884 2.32504 8.75332 1.97699 8.01238 2.00118C7.27143 2.02537 6.59877 2.41808 5.25345 3.20351L4.02558 3.92037C3.03739 4.49729 2.54329 4.78576 2.27164 5.26564C2 5.74553 2 6.32993 2 7.49873V15.7157C2 17.2514 2 18.0193 2.34226 18.4467C2.57001 18.731 2.88916 18.9222 3.242 18.9856C3.77226 19.0808 4.42148 18.7018 5.71987 17.9437C6.60156 17.429 7.45011 16.8944 8.50487 17.0394C9.38869 17.1608 10.21 17.7185 11 18.1138" />
					<path d="M8 2L8 17" />
					<path d="M15 5V9.5" />
					<path d="M18.3083 21.6835C18.0915 21.8865 17.8017 22 17.5001 22C17.1985 22 16.9087 21.8865 16.6919 21.6835C14.7063 19.813 12.0455 17.7235 13.3431 14.6898C14.0447 13.0496 15.7289 12 17.5001 12C19.2713 12 20.9555 13.0496 21.6571 14.6898C22.9531 17.7196 20.2988 19.8194 18.3083 21.6835Z" />
					<path d="M17.5 16.5H17.509" />
				</svg>
			</div>
			<div>
				<h3>Connection paths (ICE candidates)</h3>
				<p>
					These are temporary options for how devices can reach each other. They include possible network routes,
					temporary identifiers, and connection hints.
				</p>
				<p class="py-3">“Here are a few ways you can reach me.”</p>

				<div class="stacked-cards">
					<Collapsible title="Example ICE candidate Viewer">
						<div class="code">
							"candidate":"candidate:97183304 1 udp 2113939711 <mark>964c770c-50d2-4a9c-abb7-71f12137753c.local</mark> 64930 typ host generation 0 ufrag uLIy network-cost 999",
							"sdpMid":"0",
							"sdpMLineIndex":0,
							"usernameFragment":"uLIy"
						</div>
						<hr class="my-4" />
						<p>
							<mark>*)</mark> the browser used <a class="link" href="https://en.wikipedia.org/wiki/Multicast_DNS" target="_blank" rel="noopener">mDNS</a> for obfuscation, this IP is safe to "expose" 
						</p>
					</Collapsible>
					<Collapsible title="Example ICE candidate Phone">
						<div class="code">
							"candidate":"candidate:3912818361 1 udp 2113939711 <mark>192.168.2.102</mark> 53602 typ host generation 0 ufrag Fbs5 network-cost 999",
							"sdpMid":"0",
							"sdpMLineIndex":0,
							"usernameFragment":"Fbs5"
						</div>
						<hr class="my-4" />
						<p>
							<mark>*)</mark> this is a local IP address, only visible within your home network, and not a privacy risk to share with PeerLens. 
						</p>
					</Collapsible>
				</div>

				<p class="py-3 mb-0">
					In case your browser only offers publicly routable candidates, we will inform you <a href="/ipv6" class="link">about implications</a> and explicitly ask for your consent before proceeding.
				</p>
			</div>
		</div>
	</section>

	<section class="card">
		<h2 class="section-title">How the connection is established</h2>

		<div class="subtle-card">
			<div>
				<h3>1) Viewer creates a session</h3>
				<p>
					A QR code for your session is generated.<br>
					We store your viewers <a class="link" href="#sdp">SDP data</a> and <a class="link" href="#ice">ICE candidates</a> so they can be relayed to the phone when it connects.
				</p>
			</div>
		</div>

		<div class="subtle-card">
			<div>
				<h3>2) Phone joins the session</h3>
				<p>
					Scanning the QR code connects the phone to that session.<br>
					The phone sends its own <a class="link" href="#sdp">SDP data</a> and <a class="link" href="#ice">ICE candidates</a> to PeerLens, which relays them to the viewer.
				</p>
			</div>
		</div>

		<div class="subtle-card">
			<div>
				<h3>3) Devices exchange connection info</h3>
				<p>
					Both devices do the WebRTC magic and figure out how to connect to each other directly, using the relayed data.
				</p>
			</div>
		</div>

		<div class="subtle-card">
			<div>
				<h3>4) Direct connection is established</h3>
				<p>
					Once a working path is found, the phone switches to recording and the viewer to streaming mode.
				</p>
				<p class="mb-0">
					From this point on, <strong>PeerLens is no longer part of the media path</strong>.
				</p>
			</div>
		</div>

		<div class="subtle-card">
			<div>
				<h3>5) Cleanup</h3>
				<p>
					ICE candidates (meaning your local IPs) are deleted. The session data (including SDP data) remain as long as your session lasts.
				</p>
			</div>
		</div>
	</section>

	<section class="card">
		<h2 class="section-title">Can I see my data?</h2>
		<p>
			Yes! You can see all the data we have for your current session in the session info modal, available by clicking on your session shorthand in the navbar.
		</p>
		<div class="grid sm:grid-cols-2 gap-6 mt-6">
			<img src="{imgSessionViewer}" class="rounded shadow border border-teal-900" alt="Screenshot of session info modal on viewer" />
			<img src="{imgSessionPhone}" class="rounded shadow border border-teal-900" alt="Screenshot of session info modal on phone" />
		</div>
	</section>
</div>
