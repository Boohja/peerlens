<script lang="ts">
	import { toast } from '$lib/toast';

	function addTestToast() {
		toast('success', 'Test string');
	}
</script>

<div class="page">
  <div class="card">
    <p>Which side are you on?</p>
    <a href="/viewer" class="btn btn-viewer">Viewer</a>
    <a href="/phone" class="btn btn-phone">Phone</a>
    <button type="button" class="btn" onclick={addTestToast}>Test</button>
  </div>
</div>

<div class="card">
  Mwahahaha
</div>
