export function resolveRelease(release, config) {
  if (!release || typeof release.tag_name !== "string") {
    throw new Error("GitHub API response has no tag_name");
  }
  if (release.draft || release.prerelease) {
    throw new Error(`Latest release ${release.tag_name} is not a stable release`);
  }

  const version = release.tag_name.replace(/^v/, "");
  const assets = config.families.map((family) => {
    const expectedName = `${family}-TTF-${version}.7z`;
    const asset = release.assets?.find((candidate) => candidate.name === expectedName);
    if (!asset?.browser_download_url) {
      throw new Error(`Required release asset is missing: ${expectedName}`);
    }
    return {
      family,
      name: asset.name,
      size: asset.size,
      url: asset.browser_download_url,
    };
  });

  return {
    tag: release.tag_name,
    version,
    releaseUrl: release.html_url,
    assets,
  };
}
