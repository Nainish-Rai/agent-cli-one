import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class UIIntegrator {
  analyzeQueryForUIIntegration(
    query: string,
    schemaDefinitions: SchemaDefinition[]
  ) {
    const lowerQuery = query.toLowerCase();
    const analysis = {
      shouldUpdateMainContent: false,
      shouldUpdateSidebar: false,
      sections: [] as Array<{
        sectionName: string;
        targetArray: string;
        schema: SchemaDefinition;
        hookName: string;
      }>,
    };

    // Map query keywords to UI sections
    const uiMappings = [
      {
        keywords: ["recently played", "recent", "history", "last played"],
        sectionName: "Recently Played",
        targetArray: "recentlyPlayed",
        component: "main",
      },
      {
        keywords: ["made for you", "curated", "recommendations", "suggested"],
        sectionName: "Made For You",
        targetArray: "madeForYou",
        component: "main",
      },
      {
        keywords: [
          "popular albums",
          "popular",
          "trending albums",
          "top albums",
        ],
        sectionName: "Popular Albums",
        targetArray: "popularAlbums",
        component: "main",
      },
      {
        keywords: ["playlist", "playlists", "user playlist", "my playlist"],
        sectionName: "Playlists",
        targetArray: "recentlyPlayed",
        component: "sidebar",
      },
      {
        keywords: ["liked songs", "favorites", "saved songs", "hearted"],
        sectionName: "Liked Songs",
        targetArray: "recentlyPlayed",
        component: "sidebar",
      },
    ];

    // Check each schema against the query and UI mappings
    for (const schema of schemaDefinitions) {
      const tableName = schema.tableName.toLowerCase();
      const schemaKeywords = tableName.split("_").concat(tableName.split("-"));

      // Find matching UI section
      const matchingMapping = uiMappings.find((mapping) => {
        const queryMatches = mapping.keywords.some((keyword) =>
          lowerQuery.includes(keyword)
        );

        const schemaMatches = mapping.keywords.some((keyword) =>
          keyword
            .split(" ")
            .every((word) =>
              schemaKeywords.some(
                (schemaWord) =>
                  schemaWord.includes(word) || word.includes(schemaWord)
              )
            )
        );

        return queryMatches || schemaMatches;
      });

      if (matchingMapping) {
        const hookName = `use${toPascalCase(schema.tableName)}`;

        analysis.sections.push({
          sectionName: matchingMapping.sectionName,
          targetArray: matchingMapping.targetArray,
          schema,
          hookName,
        });

        if (matchingMapping.component === "main") {
          analysis.shouldUpdateMainContent = true;
        } else if (matchingMapping.component === "sidebar") {
          analysis.shouldUpdateSidebar = true;
        }
      }
    }

    // If no specific mapping found, try to infer from table structure
    if (analysis.sections.length === 0) {
      for (const schema of schemaDefinitions) {
        const hookName = `use${toPascalCase(schema.tableName)}`;

        // Check if table has music-related fields
        const hasTitle = schema.fields.some((f) =>
          ["title", "name", "song_title", "track_title"].includes(
            f.name.toLowerCase()
          )
        );
        const hasArtist = schema.fields.some((f) =>
          ["artist", "artist_name", "creator"].includes(f.name.toLowerCase())
        );

        if (hasTitle && hasArtist) {
          analysis.sections.push({
            sectionName: `${toPascalCase(schema.tableName)} Collection`,
            targetArray: "recentlyPlayed",
            schema,
            hookName,
          });
          analysis.shouldUpdateMainContent = true;
        } else {
          console.log(
            chalk.yellow(
              `   ⚠️  Schema ${schema.tableName} doesn't match known UI patterns`
            )
          );
        }
      }
    }

    return analysis;
  }

  async updateSpotifyMainContent(
    schemaDefinitions: SchemaDefinition[],
    queryAnalysis: any
  ) {
    const componentPath = path.join(
      process.cwd(),
      "src",
      "components",
      "spotify-main-content.tsx"
    );

    if (!fs.existsSync(componentPath)) {
      console.log(
        chalk.yellow(
          "   ⚠️  SpotifyMainContent component not found, skipping integration"
        )
      );
      return;
    }

    let content = fs.readFileSync(componentPath, "utf8");

    // Add imports for the hooks
    const hookImports = queryAnalysis.sections
      .map((section: any) => section.hookName)
      .join(", ");

    const importMatch = content.match(/import.*from "lucide-react"/);
    if (importMatch) {
      const newImports = `${importMatch[0]}
import { useEffect } from "react"
import { ${hookImports} } from '@/hooks'`;
      content = content.replace(importMatch[0], newImports);
    }

    let updatedContent = content;

    // Process each section from the query analysis
    for (const section of queryAnalysis.sections) {
      const { sectionName, targetArray, schema, hookName } = section;

      const arrayMatch = updatedContent.match(
        new RegExp(`const ${targetArray} = \\[[\\s\\S]*?\\]`)
      );

      if (arrayMatch) {
        updatedContent = updatedContent.replace(
          arrayMatch[0],
          `// Fetch ${sectionName.toLowerCase()} from database
  const { data: ${targetArray}Data, loading: ${targetArray}Loading, fetchAll: fetch${toPascalCase(
            targetArray
          )} } = ${hookName}();

  // Transform database records to frontend format
  const ${targetArray} = (${targetArray}Data?.records || []).map((record: any) => ({
    id: record.id?.toString() || record.song_id?.toString() || record.playlist_id?.toString() || record.album_id?.toString() || Math.random().toString(),
    title: record.title || record.song_title || record.name || record.playlist_name || record.album_name || "Unknown Title",
    artist: record.artist || record.artist_name || record.creator || record.description || record.subtitle || "Unknown Artist",
    album: record.album || record.album_name || record.collection || record.category || record.title || "Unknown Album",
    image: record.image || record.cover_art || record.artwork_url || record.thumbnail || record.cover_image,
    duration: record.duration || record.length || record.total_duration || 180
  }))`
        );

        // Add to useEffect
        const useEffectMatch = updatedContent.match(
          /useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/
        );
        if (useEffectMatch) {
          const fetchCall = `fetch${toPascalCase(targetArray)}();`;
          if (!useEffectMatch[0].includes(fetchCall)) {
            const newUseEffect = useEffectMatch[0].replace(
              /(\s+)(\}, \[\]\);)/,
              `$1  ${fetchCall}$1$2`
            );
            updatedContent = updatedContent.replace(
              useEffectMatch[0],
              newUseEffect
            );
          }
        } else {
          const componentMatch = updatedContent.match(
            /export default function SpotifyMainContent\([^}]+\) \{/
          );
          if (componentMatch) {
            const useEffectCode = `
  useEffect(() => {
    fetch${toPascalCase(targetArray)}();
  }, []);

`;
            updatedContent = updatedContent.replace(
              componentMatch[0],
              componentMatch[0] + useEffectCode
            );
          }
        }
      }
    }

    // Add loading states
    const loadingStates = queryAnalysis.sections.map(
      (section: any) => `${section.targetArray}Loading`
    );

    if (loadingStates.length > 0) {
      const loadingCheck = `const isLoading = ${loadingStates.join(" || ")};

  if (isLoading) {
    return (
      <div className="bg-[var(--color-background-primary)] text-[var(--color-text-primary)] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">Loading your music...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-background-primary)] text-[var(--color-text-primary)] min-h-screen">`;

      const componentStart = updatedContent.match(
        /export default function SpotifyMainContent\([^}]+\) \{[\s\S]*?return \(/
      );
      if (componentStart) {
        updatedContent = updatedContent.replace("return (", loadingCheck);
      }
    }

    fs.writeFileSync(componentPath, updatedContent);
  }

  async updateSpotifySidebar(
    schemaDefinitions: SchemaDefinition[],
    queryAnalysis: any
  ) {
    const componentPath = path.join(
      process.cwd(),
      "src",
      "components",
      "spotify-sidebar.tsx"
    );

    if (!fs.existsSync(componentPath)) {
      console.log(
        chalk.yellow(
          "   ⚠️  SpotifySidebar component not found, skipping integration"
        )
      );
      return;
    }

    let content = fs.readFileSync(componentPath, "utf8");

    const hookImports = queryAnalysis.sections
      .filter((section: any) => section.targetArray === "recentlyPlayed")
      .map((section: any) => section.hookName)
      .join(", ");

    if (hookImports) {
      const importMatch = content.match(/import.*from 'lucide-react'/);
      if (importMatch) {
        const newImports = `${importMatch[0]}
import { useEffect } from 'react'
import { ${hookImports} } from '@/hooks'`;
        content = content.replace(importMatch[0], newImports);
      }

      let updatedContent = content;
      const sidebarSection = queryAnalysis.sections.find(
        (s: any) => s.targetArray === "recentlyPlayed"
      );

      if (sidebarSection) {
        const { hookName } = sidebarSection;

        const arrayMatch = updatedContent.match(
          /const recentlyPlayed: PlaylistItem\[\] = \[[\s\S]*?\]/
        );
        if (arrayMatch) {
          updatedContent = updatedContent.replace(
            arrayMatch[0],
            `// Fetch playlists from database
  const { data: playlistData, loading: playlistLoading, fetchAll: fetchPlaylists } = ${hookName}();

  // Transform database records to sidebar format
  const recentlyPlayed: PlaylistItem[] = (playlistData?.records || []).map((record: any) => ({
    id: record.id?.toString() || Math.random().toString(),
    title: record.title || record.name || record.playlist_name || "Unknown Playlist",
    subtitle: record.subtitle || record.description || "Playlist",
    image: record.image || record.cover_art || record.thumbnail,
    duration: record.duration || record.total_duration || 180
  }))`
          );

          const componentMatch = updatedContent.match(
            /export default function SpotifySidebar\([^}]+\) \{[\s\S]*?\n  const/
          );
          if (componentMatch) {
            const useEffectCode = `
  useEffect(() => {
    fetchPlaylists();
  }, []);

  const`;
            updatedContent = updatedContent.replace(
              /(\n  const)/,
              useEffectCode
            );
          }
        }
      }

      fs.writeFileSync(componentPath, updatedContent);
    }
  }
}
