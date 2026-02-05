import { motion } from "framer-motion";
import { Heart, MapPin, Bed, Bath, Square, Star, Check, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrustScore } from "@/components/TrustBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PropertyCardProps {
  id: number | string;
  title: string;
  location: string;
  price: number;
  priceUnit: string;
  image: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  rating: number;
  isVerified?: boolean;
  type: string;
  source?: "search" | "recommendation" | "direct";
  ownerTrustScore?: number;
}

const PropertyCard = ({
  id,
  title,
  location,
  price,
  priceUnit,
  image,
  bedrooms,
  bathrooms,
  area,
  rating,
  isVerified = false,
  type,
  source = "recommendation",
  ownerTrustScore,
}: PropertyCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Check if property is already in favorites on mount
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || id === "demo") return;
      
      try {
        const { data } = await supabase
          .from("property_favorites")
          .select("id")
          .eq("property_id", id.toString())
          .eq("user_id", user.id)
          .maybeSingle();
        
        setIsLiked(!!data);
      } catch (error) {
        console.error("Error checking favorite status:", error);
      }
    };

    checkFavoriteStatus();
  }, [user, id]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: t("toast.loginRequired"),
        description: t("toast.loginToFavorite"),
      });
      return;
    }

    if (id === "demo" || isLoading) return;

    setIsLoading(true);
    try {
      if (isLiked) {
        await supabase
          .from("property_favorites")
          .delete()
          .eq("property_id", id.toString())
          .eq("user_id", user.id);
        setIsLiked(false);
        toast({ title: t("toast.removedFromFavorites") });
      } else {
        await supabase
          .from("property_favorites")
          .insert({ property_id: id.toString(), user_id: user.id });
        setIsLiked(true);
        toast({ title: t("toast.addedToFavorites") });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: t("common.error"),
        description: t("error.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-elegant transition-all duration-300 border border-border/50"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Overlay Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-card/90 backdrop-blur-sm text-foreground">
            {type}
          </span>
          {isVerified && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/90 backdrop-blur-sm text-accent-foreground flex items-center gap-1">
              <Check className="w-3 h-3" />
              {t("card.verified")}
            </span>
          )}
          {ownerTrustScore !== undefined && ownerTrustScore >= 60 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/90 backdrop-blur-sm text-success-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {ownerTrustScore}
            </span>
          )}
        </div>

        {/* Like Button */}
        <button
          onClick={toggleFavorite}
          disabled={isLoading}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors disabled:opacity-50"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isLiked ? "fill-primary text-primary" : "text-muted-foreground"
            }`}
          />
        </button>

        {/* Price Badge */}
        <div className="absolute bottom-3 left-3 px-4 py-2 rounded-xl bg-card/95 backdrop-blur-sm">
          <span className="text-lg font-bold text-foreground">
            {price.toLocaleString('fr-FR')} FCFA
          </span>
          <span className="text-sm text-muted-foreground">/{priceUnit}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title & Location */}
        <h3 className="font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="line-clamp-1">{location}</span>
        </div>

        {/* Features */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            <span>{bedrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-4 h-4" />
            <span>{bathrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Square className="w-4 h-4" />
            <span>{area} m²</span>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-gold text-gold" />
            <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
            <span className="text-muted-foreground text-sm">(24 {t("card.reviews")})</span>
          </div>
          <Link to={`/property/${id}?source=${source}`} className="text-primary text-sm font-medium hover:underline">
            {t("card.viewDetails")}
          </Link>
        </div>
      </div>
    </motion.article>
  );
};

export default PropertyCard;