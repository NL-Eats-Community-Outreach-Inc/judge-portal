import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  PreTrainedModel,
  PreTrainedTokenizer,
} from '@huggingface/transformers';

const RULES_CONFIG = {
  TOP_COURSES: 3,
};

// load model in when server starts. Using BAAI/bge-reranker-base with Xenova version
// BAAI/bge-reranker-base with 16b quantized for lightweight
class CrossEncoderPipeline {
  static modelId = 'Xenova/bge-reranker-base';
  static tokenizer: PreTrainedTokenizer | null = null;
  static model: PreTrainedModel | null = null;

  static async getInstance() {
    if (this.tokenizer === null || this.model === null) {
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
      this.model = await AutoModelForSequenceClassification.from_pretrained(this.modelId);
    }
    return { tokenizer: this.tokenizer, model: this.model };
  }
}

/**
 * Re-ranks a list of candidate courses based on how similar they are to a completed course.
 * @param candidateCourses using the BAAI/bge-M3 vectorized version, Submit only the top scoring courses
 * @param completedCourseDescription The description of the course the user just completed or is looking at
 * returns a reranked recommendation lists using BAAI/bge-reranker-base returning top 3 recommendation
 */
export async function CrossEncoderRecommender(
  candidateCourses: string[],
  completedCourseDescription: string
) {
  const { tokenizer, model } = await CrossEncoderPipeline.getInstance();

  const scoredCourses = [];
  for (const candidateCourseDescription of candidateCourses) {
    const inputs = await tokenizer(completedCourseDescription, {
      text_pair: candidateCourseDescription,
      padding: true,
      truncation: true,
    });
    const output = await model(inputs);
    const score = output.logits.data[0];
    scoredCourses.push({
      course: candidateCourseDescription,
      score: score,
    });
  }
  scoredCourses.sort((a, b) => b.score - a.score);

  return scoredCourses.slice(0, RULES_CONFIG.TOP_COURSES);
}
