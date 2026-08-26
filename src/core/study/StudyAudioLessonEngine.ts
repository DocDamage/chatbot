/**
 * Study Audio Lesson & Podcast Engine (PX15-T09)
 *
 * Generates structured audio lesson scripts, multi-voice study podcasts,
 * timestamped cue points, and accessible text transcripts.
 */

import * as crypto from 'crypto';
import { PodcastCuePoint, SourceChunk, StudyAudioLesson, StudyCollection } from './StudyTypes';

export class StudyAudioLessonEngine {
  /**
   * Generates a multi-voice audio lesson or study podcast script.
   */
  public generateAudioLesson(
    collection: StudyCollection,
    chunks: SourceChunk[],
    format: 'chapter_audio' | 'qa_lesson' | 'short_recap' | 'two_host_dialogue' = 'two_host_dialogue',
    title?: string
  ): StudyAudioLesson {
    const lessonTitle = title || `${collection.subject} - Deep Dive Audio Study`;
    const speakers = format === 'two_host_dialogue' ? ['Alex', 'Sam'] : ['Narrator'];
    const scriptDialogue: Array<{ speaker: string; text: string }> = [];
    const cuePoints: PodcastCuePoint[] = [];

    let currentTimeSec = 0;
    const wordsPerMinute = 150;

    // Intro turn
    if (format === 'two_host_dialogue') {
      scriptDialogue.push({
        speaker: 'Alex',
        text: `Welcome back to the Study Studio! Today we are exploring "${collection.subject}". Sam, what is our main objective today?`
      });
      scriptDialogue.push({
        speaker: 'Sam',
        text: `We are breaking down the core concepts from our study collection, covering ${chunks.length} key areas with source-backed insights.`
      });
      currentTimeSec += 12;
    } else {
      scriptDialogue.push({
        speaker: 'Narrator',
        text: `Welcome to this study audio guide covering ${collection.subject}.`
      });
      currentTimeSec += 5;
    }

    // Content turns per chunk
    for (let i = 0; i < chunks.length; i++) {
      const chk = chunks[i];
      const topic = chk.chapterTitle || `Section ${i + 1}`;
      const mainContent = chk.text.replace(/\s+/g, ' ').substring(0, 200);

      cuePoints.push({
        timeSec: currentTimeSec,
        speaker: format === 'two_host_dialogue' ? (i % 2 === 0 ? 'Alex' : 'Sam') : 'Narrator',
        text: `Discussion on ${topic}`,
        topic
      });

      if (format === 'two_host_dialogue') {
        const spk1 = i % 2 === 0 ? 'Alex' : 'Sam';
        const spk2 = i % 2 === 0 ? 'Sam' : 'Alex';

        scriptDialogue.push({
          speaker: spk1,
          text: `Let's focus on ${topic}. The source highlights that: "${mainContent}".`
        });
        scriptDialogue.push({
          speaker: spk2,
          text: `Right, and this principle is crucial because it forms the baseline for practical application in ${chk.sourceTitle}.`
        });
        currentTimeSec += 20;
      } else {
        scriptDialogue.push({
          speaker: 'Narrator',
          text: `Now focusing on ${topic}: "${mainContent}". As detailed in ${chk.sourceTitle}.`
        });
        currentTimeSec += 15;
      }
    }

    // Outro
    const outroSpeaker = format === 'two_host_dialogue' ? 'Alex' : 'Narrator';
    scriptDialogue.push({
      speaker: outroSpeaker,
      text: `That concludes our audio overview for ${collection.subject}. Be sure to test your recall with the accompanying flashcards and quiz in Study Studio.`
    });
    currentTimeSec += 8;

    const fullTranscript = scriptDialogue
      .map((turn) => `**${turn.speaker}**: ${turn.text}`)
      .join('\n\n');

    const sourceNotes = chunks
      .map((c) => `- **${c.chapterTitle || 'Concept'}**: ${c.anchor.citationText}`)
      .join('\n');

    return {
      id: `lesson-${crypto.randomUUID()}`,
      collectionId: collection.id,
      title: lessonTitle,
      format,
      speakers,
      scriptDialogue,
      fullTranscript,
      cuePoints,
      durationSec: currentTimeSec,
      sourceNotes
    };
  }
}
