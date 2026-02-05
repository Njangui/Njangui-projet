import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Property {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  price: number;
  price_unit: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  property_type: string;
  listing_type: string;
  images: string[] | null;
  is_verified: boolean | null;
  view_count: number | null;
  created_at: string | null;
  amenities: string[] | null;
  available_from: string | null;
}

interface UserProfile {
  city: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_property_types: string[] | null;
  preferred_neighborhoods: string[] | null;
  preferred_listing_types: string[] | null;
  preferred_amenities: string[] | null;
  move_in_timeline: string | null;
}

interface ViewingPattern {
  propertyTypes: Record<string, number>;
  listingTypes: Record<string, number>;
  cities: Record<string, number>;
  neighborhoods: Record<string, number>;
  priceRange: { min: number; max: number };
  amenities: Record<string, number>;
  avgViewDuration: number;
}

interface RecommendationScore {
  property: Property;
  score: number;
  reasons: string[];
}

// Enhanced weights for different recommendation factors
const WEIGHTS = {
  exactProfileMatch: 30,    // Exact match with user preferences
  viewingHistory: 25,       // Based on user's viewing patterns
  collaborativeFilter: 15,  // Similar users' preferences
  locationMatch: 12,        // City/neighborhood match
  availability: 8,          // Property available when user wants
  popularity: 5,            // View count / engagement
  recency: 3,               // Newer listings
  verification: 2,          // Verified properties
};

export function useRecommendations(limit: number = 6) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all available properties
      const { data: properties, error: propError } = await supabase
        .from("properties")
        .select("*")
        .eq("is_published", true)
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(200); // Fetch more for better filtering

      if (propError) throw propError;

      if (!properties || properties.length === 0) {
        setRecommendations([]);
        return;
      }

      let userProfile: UserProfile | null = null;
      let userFavorites: string[] = [];
      let viewingPattern: ViewingPattern | null = null;
      let collaborativePropertyIds: Set<string> = new Set();

      // Get user data if authenticated
      if (user) {
        // Fetch user profile with all preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select(`
            city, budget_min, budget_max, 
            preferred_property_types, preferred_neighborhoods,
            preferred_listing_types, preferred_amenities,
            move_in_timeline
          `)
          .eq("user_id", user.id)
          .single();

        userProfile = profile as UserProfile;

        // Fetch user favorites
        const { data: favorites } = await supabase
          .from("property_favorites")
          .select("property_id")
          .eq("user_id", user.id);

        userFavorites = favorites?.map((f) => f.property_id) || [];

        // Fetch detailed viewing history for pattern analysis
        const { data: viewHistory } = await supabase
          .from("property_views")
          .select("property_id, view_duration_seconds")
          .eq("user_id", user.id)
          .order("viewed_at", { ascending: false })
          .limit(100);

        if (viewHistory && viewHistory.length > 0) {
          // Get properties with good engagement (> 15 seconds = interested)
          const engagedViews = viewHistory.filter(v => (v.view_duration_seconds || 0) > 15);
          const viewedPropertyIds = engagedViews.map(v => v.property_id);
          
          // Calculate average view duration
          const avgDuration = engagedViews.length > 0 
            ? engagedViews.reduce((sum, v) => sum + (v.view_duration_seconds || 0), 0) / engagedViews.length
            : 0;

          if (viewedPropertyIds.length > 0) {
            const { data: viewedProperties } = await supabase
              .from("properties")
              .select("property_type, listing_type, city, neighborhood, price, amenities")
              .in("id", viewedPropertyIds);

            if (viewedProperties && viewedProperties.length > 0) {
              // Build detailed viewing pattern
              const propertyTypes: Record<string, number> = {};
              const listingTypes: Record<string, number> = {};
              const cities: Record<string, number> = {};
              const neighborhoods: Record<string, number> = {};
              const amenitiesCount: Record<string, number> = {};
              const prices: number[] = [];

              viewedProperties.forEach(p => {
                propertyTypes[p.property_type] = (propertyTypes[p.property_type] || 0) + 1;
                listingTypes[p.listing_type] = (listingTypes[p.listing_type] || 0) + 1;
                cities[p.city] = (cities[p.city] || 0) + 1;
                if (p.neighborhood) {
                  neighborhoods[p.neighborhood] = (neighborhoods[p.neighborhood] || 0) + 1;
                }
                prices.push(p.price);
                
                // Track amenities viewed
                if (p.amenities && Array.isArray(p.amenities)) {
                  p.amenities.forEach((a: string) => {
                    amenitiesCount[a] = (amenitiesCount[a] || 0) + 1;
                  });
                }
              });

              viewingPattern = {
                propertyTypes,
                listingTypes,
                cities,
                neighborhoods,
                priceRange: {
                  min: Math.min(...prices) * 0.7,
                  max: Math.max(...prices) * 1.3,
                },
                amenities: amenitiesCount,
                avgViewDuration: avgDuration,
              };
            }
          }
        }

        // Collaborative filtering: Find properties liked by similar users
        if (userFavorites.length > 0) {
          // Find users who like the same properties
          const { data: similarUsersFavorites } = await supabase
            .from("property_favorites")
            .select("property_id, user_id")
            .in("property_id", userFavorites.slice(0, 10)) // Top 10 favorites
            .neq("user_id", user.id);

          if (similarUsersFavorites && similarUsersFavorites.length > 0) {
            // Get unique similar users
            const similarUserIds = [...new Set(similarUsersFavorites.map(f => f.user_id))];
            
            // Find what else these similar users like
            const { data: otherFavorites } = await supabase
              .from("property_favorites")
              .select("property_id")
              .in("user_id", similarUserIds.slice(0, 20)) // Top 20 similar users
              .not("property_id", "in", `(${userFavorites.join(",")})`);

            if (otherFavorites) {
              // Count how many similar users liked each property
              const propertyCount: Record<string, number> = {};
              otherFavorites.forEach(f => {
                propertyCount[f.property_id] = (propertyCount[f.property_id] || 0) + 1;
              });
              
              // Properties liked by 2+ similar users get priority
              Object.entries(propertyCount).forEach(([id, count]) => {
                if (count >= 2) collaborativePropertyIds.add(id);
              });
            }
          }
        }
      }

      // Score each property with enhanced algorithm
      const scoredProperties: RecommendationScore[] = properties.map((property) => {
        let score = 0;
        const reasons: string[] = [];

        // 1. EXACT PROFILE MATCH (highest priority)
        if (userProfile) {
          // Property type match
          if (userProfile.preferred_property_types?.includes(property.property_type)) {
            score += WEIGHTS.exactProfileMatch * 0.25;
            reasons.push("Type de bien préféré");
          }

          // Listing type match
          if (userProfile.preferred_listing_types?.includes(property.listing_type)) {
            score += WEIGHTS.exactProfileMatch * 0.2;
          }

          // City match
          if (userProfile.city && property.city.toLowerCase() === userProfile.city.toLowerCase()) {
            score += WEIGHTS.locationMatch * 0.7;
            reasons.push("Dans votre ville");
          }

          // Neighborhood match
          if (userProfile.preferred_neighborhoods && property.neighborhood) {
            const normalizedNeighborhood = property.neighborhood.toLowerCase();
            const matchingNeighborhood = userProfile.preferred_neighborhoods.some(n => 
              normalizedNeighborhood.includes(n.toLowerCase()) || n.toLowerCase().includes(normalizedNeighborhood)
            );
            if (matchingNeighborhood) {
              score += WEIGHTS.locationMatch * 0.5;
              reasons.push("Quartier recherché");
            }
          }

          // Budget match (strict)
          if (property.price_unit === "month" || property.price_unit === "mois") {
            const monthlyPrice = property.price;
            if (userProfile.budget_min !== null && userProfile.budget_max !== null) {
              if (monthlyPrice >= userProfile.budget_min && monthlyPrice <= userProfile.budget_max) {
                score += WEIGHTS.exactProfileMatch * 0.3;
                reasons.push("Dans votre budget");
              } else if (monthlyPrice <= userProfile.budget_max * 1.15 && monthlyPrice >= userProfile.budget_min * 0.85) {
                score += WEIGHTS.exactProfileMatch * 0.15;
                reasons.push("Proche de votre budget");
              }
            }
          }

          // Amenities match
          if (userProfile.preferred_amenities && userProfile.preferred_amenities.length > 0 && property.amenities) {
            const matchingAmenities = property.amenities.filter(a => 
              userProfile.preferred_amenities!.includes(a)
            );
            if (matchingAmenities.length > 0) {
              const amenityScore = (matchingAmenities.length / userProfile.preferred_amenities.length) * WEIGHTS.exactProfileMatch * 0.25;
              score += amenityScore;
              if (matchingAmenities.length >= 3) {
                reasons.push(`${matchingAmenities.length} équipements souhaités`);
              }
            }
          }

          // Availability match based on move timeline
          if (userProfile.move_in_timeline && property.available_from) {
            const availableDate = new Date(property.available_from);
            const now = new Date();
            const daysUntilAvailable = Math.ceil((availableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            let timelineMatch = false;
            switch (userProfile.move_in_timeline) {
              case "immediate":
                timelineMatch = daysUntilAvailable <= 7;
                break;
              case "within_month":
                timelineMatch = daysUntilAvailable <= 30;
                break;
              case "within_3months":
                timelineMatch = daysUntilAvailable <= 90;
                break;
              case "flexible":
                timelineMatch = true;
                break;
            }
            
            if (timelineMatch) {
              score += WEIGHTS.availability;
              if (daysUntilAvailable <= 7) reasons.push("Disponible immédiatement");
            }
          }
        }

        // 2. VIEWING HISTORY PATTERN MATCH
        if (viewingPattern) {
          // Property type from viewing history
          const typeScore = viewingPattern.propertyTypes[property.property_type] || 0;
          if (typeScore > 0) {
            score += Math.min(typeScore * 4, WEIGHTS.viewingHistory * 0.3);
            if (typeScore >= 3) reasons.push("Type consulté fréquemment");
          }

          // Listing type from viewing history
          const listingScore = viewingPattern.listingTypes[property.listing_type] || 0;
          if (listingScore > 0) {
            score += Math.min(listingScore * 3, WEIGHTS.viewingHistory * 0.2);
          }

          // City from viewing history
          const cityScore = viewingPattern.cities[property.city] || 0;
          if (cityScore > 0) {
            score += Math.min(cityScore * 3, WEIGHTS.viewingHistory * 0.2);
          }

          // Neighborhood from viewing history
          if (property.neighborhood && viewingPattern.neighborhoods[property.neighborhood]) {
            score += Math.min(viewingPattern.neighborhoods[property.neighborhood] * 4, WEIGHTS.viewingHistory * 0.15);
          }

          // Price range from viewing history
          if (property.price >= viewingPattern.priceRange.min && 
              property.price <= viewingPattern.priceRange.max) {
            score += WEIGHTS.viewingHistory * 0.15;
          }

          // Amenities from viewing history
          if (property.amenities && property.amenities.length > 0) {
            let amenityHistoryScore = 0;
            property.amenities.forEach(a => {
              if (viewingPattern.amenities[a]) {
                amenityHistoryScore += viewingPattern.amenities[a];
              }
            });
            score += Math.min(amenityHistoryScore, WEIGHTS.viewingHistory * 0.1);
          }
        }

        // 3. COLLABORATIVE FILTERING BOOST
        if (collaborativePropertyIds.has(property.id)) {
          score += WEIGHTS.collaborativeFilter;
          reasons.push("Populaire chez profils similaires");
        }

        // 4. PENALIZE ALREADY FAVORITED
        if (userFavorites.includes(property.id)) {
          score -= 50; // Strong penalty for already favorited
        }

        // 5. POPULARITY SCORE
        const viewCount = property.view_count || 0;
        const popularityScore = Math.min(Math.log10(viewCount + 1) * 2, WEIGHTS.popularity);
        score += popularityScore;
        if (viewCount > 100) {
          reasons.push("Très populaire");
        }

        // 6. RECENCY SCORE
        if (property.created_at) {
          const daysOld = (Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24);
          const recencyScore = Math.max(0, (14 - daysOld) / 14) * WEIGHTS.recency;
          score += recencyScore;
          if (daysOld < 3) {
            reasons.push("Nouveau");
          }
        }

        // 7. VERIFICATION BONUS
        if (property.is_verified) {
          score += WEIGHTS.verification;
          reasons.push("Vérifié");
        }

        // 8. CONTENT-BASED AMENITIES MATCHING (from favorites)
        if (userFavorites.length > 0) {
          const favoritedProps = properties.filter(p => userFavorites.includes(p.id));
          const preferredAmenities = new Set<string>();
          favoritedProps.forEach(p => {
            p.amenities?.forEach((a: string) => preferredAmenities.add(a));
          });

          const matchingAmenities = property.amenities?.filter(a => preferredAmenities.has(a)) || [];
          if (matchingAmenities.length >= 2) {
            score += Math.min(matchingAmenities.length * 1.5, 8);
          }
        }

        // 9. DEFAULT SCORING FOR NON-AUTHENTICATED USERS
        if (!user) {
          if (property.is_verified) score += 8;
          if (viewCount > 30) score += 4;
          if (property.created_at) {
            const daysOld = (Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld < 7) score += 6;
          }
          // Boost properties with more amenities for anonymous users
          if (property.amenities && property.amenities.length > 5) {
            score += 3;
          }
        }

        return { property, score, reasons: reasons.slice(0, 3) }; // Limit reasons shown
      });

      // Sort by score
      scoredProperties.sort((a, b) => b.score - a.score);

      // Apply diversity: limit properties from same city/neighborhood for variety
      const diverseResults: RecommendationScore[] = [];
      const cityCount: Record<string, number> = {};
      const neighborhoodCount: Record<string, number> = {};
      const maxPerCity = Math.ceil(limit * 0.6); // 60% max from same city
      const maxPerNeighborhood = Math.ceil(limit * 0.4); // 40% max from same neighborhood

      for (const item of scoredProperties) {
        const city = item.property.city;
        const neighborhood = item.property.neighborhood || "other";
        
        cityCount[city] = (cityCount[city] || 0) + 1;
        neighborhoodCount[neighborhood] = (neighborhoodCount[neighborhood] || 0) + 1;

        // Allow if within limits or we don't have enough results yet
        if ((cityCount[city] <= maxPerCity && neighborhoodCount[neighborhood] <= maxPerNeighborhood) || 
            diverseResults.length < Math.ceil(limit / 2)) {
          diverseResults.push(item);
        }

        if (diverseResults.length >= limit) break;
      }

      // Fill remaining slots if needed
      if (diverseResults.length < limit) {
        for (const item of scoredProperties) {
          if (!diverseResults.includes(item)) {
            diverseResults.push(item);
            if (diverseResults.length >= limit) break;
          }
        }
      }

      setRecommendations(diverseResults.map(r => r.property));
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError("Erreur lors du chargement des recommandations");
    } finally {
      setLoading(false);
    }
  };

  return { recommendations, loading, error, refetch: fetchRecommendations };
}
